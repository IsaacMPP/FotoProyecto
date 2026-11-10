using FC.SDK;
using FC.SDK.Canon;
using System.Collections.Concurrent;
using System.Text.Json;
using System.Diagnostics;

internal static class Program
{
    private static readonly object Gate = new();
    private static void Emit(string type,string message)
    { lock(Gate) Console.WriteLine(JsonSerializer.Serialize(new { type, message })); }
    private static readonly ConcurrentQueue<uint> Items = new();
    private static bool IsJpeg(byte[] bytes) => bytes.Length > 512 && bytes[0] == 255 && bytes[1] == 216;
    private static bool ExtractRawJpeg(string rawPath,string destination)
    {
        var exe=Path.Combine(AppContext.BaseDirectory,"exiftool.exe");
        if(!File.Exists(exe))return false;
        foreach(var tag in new[]{"JpgFromRaw","PreviewImage","OtherImage","ThumbnailImage"})
        {
            string temp=destination+".partial";
            try
            {
                using var p=new Process();
                p.StartInfo.FileName=exe;
                p.StartInfo.ArgumentList.Add("-b");
                p.StartInfo.ArgumentList.Add("-"+tag);
                p.StartInfo.ArgumentList.Add(rawPath);
                p.StartInfo.UseShellExecute=false;
                p.StartInfo.RedirectStandardOutput=true;
                p.StartInfo.CreateNoWindow=true;
                if(!p.Start())continue;
                using(var dest=File.Create(temp))p.StandardOutput.BaseStream.CopyTo(dest);
                if(!p.WaitForExit(15000)){p.Kill(true);continue;}
                var bytes=File.ReadAllBytes(temp);
                if(p.ExitCode==0&&IsJpeg(bytes)){File.Move(temp,destination,true);Emit("photo",destination);return true;}
            }
            catch(Exception e){Emit("error","Previsualización RAW: "+e.Message);}
            finally{try{if(File.Exists(temp))File.Delete(temp);}catch{}}
        }
        return false;
    }
    public static async Task<int> Main(string[] args)
    {
        if(args.Length < 2 || !System.Net.IPAddress.TryParse(args[0],out var parsed) ||
           !System.Net.IPAddress.IsLoopback(parsed) && parsed.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
        { Emit("error","Dirección IP Wi-Fi inválida"); return 2; }
        var ip=args[0];
        // Wi-Fi is deliberately JPEG-only: RAW remains on the camera card.
        // Preserve the optional argument for backward-compatible launchers.
        bool fastJpegMode=true;
        int skippedRaw=0,skippedUnknown=0;
        string output=Path.GetFullPath(args[1]);
        Directory.CreateDirectory(output);
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;cts.Cancel();};
        try
        {
            Environment.SetEnvironmentVariable("DEMI_WIFI_SKIP_OPTIONAL_STARTUP", "1");
            Emit("status","PTP/IP: iniciando conexión TCP con "+ip+":15740");
            await using var camera = CanonCamera.ConnectWifi(ip,"Demi Visor Studio");
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(35));
            Emit("status","PTP/IP: enviando identidad del cliente y esperando autorización de la Canon...");
            var result=await camera.OpenSessionAsync(timeout.Token);
            if(result != EdsError.OK) throw new Exception("No se pudo abrir sesión Wi-Fi: "+result);
            Emit("status","PTP/IP: sesión aceptada; activando recepción de fotos...");
            camera.ObjectAdded+=(_,e)=> Items.Enqueue(e.ObjectHandle);
            camera.StartEventPolling(TimeSpan.FromMilliseconds(75));
            try
            {
                var save=await camera.SetSaveToAsync(EdsSaveTo.Both,cts.Token);
                if(save!=EdsError.OK) Emit("error","No se pudo seleccionar guardar en tarjeta y PC ("+save+"). Se escucharán eventos disponibles.");
            } catch(Exception ex) { Emit("error","Destino de captura: "+ex.Message); }
            Emit("status","Canon conectada por Wi-Fi ("+ip+"). Recepción de nuevos disparos activa.");
            Emit("status","Wi-Fi JPEG exclusivamente: CR2/CR3 no se descargan. Se conservan en la tarjeta si Guardar en ambos está disponible.");
            var last=DateTime.UtcNow;
            while(!cts.IsCancellationRequested)
            {
                while(Items.TryDequeue(out var handle))
                {
                    try
                    {
                        var (_,name)=await camera.GetObjectFileNameAsync(handle,cts.Token);
                        name=Path.GetFileName(name);
                        // An unknown handle can represent a RAW (or an incomplete
                        // object notification). Do not mislabel it as a JPG and
                        // accidentally download dozens of MB on Wi-Fi.
                        if(string.IsNullOrWhiteSpace(name))
                        {
                            var unknownComplete=await camera.TransferCompleteAsync(handle,cts.Token);
                            if(unknownComplete!=EdsError.OK) Emit("error","Objeto sin identificar: confirmación pendiente ("+unknownComplete+").");
                            else if(++skippedUnknown==1 || skippedUnknown%25==0)
                                Emit("status","Wi-Fi: objeto sin nombre confirmado sin descarga ("+skippedUnknown+" omitidos).");
                            continue;
                        }
                        var ext=Path.GetExtension(name).ToUpperInvariant();
                        string unique=DateTime.UtcNow.ToString("yyyyMMdd_HHmmssfff")+"_"+name;
                        if(ext==".CR2"||ext==".CR3")
                        {
                            // EOS camera stores RAW on its memory card via EdsSaveTo.Both.
                            // Acknowledge host-side transfer without downloading the 30 MB file.
                            // Do not delete, convert or overwrite the original on camera card.
                            var rawComplete=await camera.TransferCompleteAsync(handle,cts.Token);
                            if(rawComplete!=EdsError.OK) Emit("error","RAW en tarjeta: confirmación pendiente ("+rawComplete+").");
                            else if(++skippedRaw<=3) Emit("status","RAW conservado en tarjeta; se omite descarga Wi-Fi para mostrar el JPEG antes.");
                            continue;
                        }
                        if(ext!=".JPG" && ext!=".JPEG")
                        {
                            // Never request file contents for unsupported/RAW
                            // objects on Wi-Fi. Acknowledge the camera only.
                            var unsupportedComplete=await camera.TransferCompleteAsync(handle,cts.Token);
                            if(unsupportedComplete!=EdsError.OK)
                                Emit("error","Archivo no JPEG: confirmación pendiente ("+unsupportedComplete+").");
                            continue;
                        }
                        string file=Path.Combine(output,unique);
                        string partial=file+".part";
                        try
                        {
                            var downloadClock=Stopwatch.StartNew();
                            await using(var stream=new FileStream(partial,FileMode.Create,FileAccess.Write,FileShare.None,1024*1024,FileOptions.SequentialScan))
                            {
                                var err=await camera.DownloadAsync(handle,stream,cts.Token);
                                if(err!=EdsError.OK)throw new Exception("Descarga: "+err);
                            }
                            File.Move(partial,file,true); // Complete original, full resolution; never show half-written files.
                            downloadClock.Stop();
                            Emit("status","Foto original "+Path.GetFileName(file)+" descargada en "+downloadClock.Elapsed.TotalSeconds.ToString("F2",System.Globalization.CultureInfo.InvariantCulture)+" s");
                            Emit("photo",file); // Tell gallery immediately, before housekeeping PTP command.
                            var complete=await camera.TransferCompleteAsync(handle,cts.Token);
                            if(complete!=EdsError.OK)Emit("error","TransferComplete: "+complete);
                        }
                        finally {try{if(File.Exists(partial))File.Delete(partial);}catch{}}
                    }
                    catch(Exception e){Emit("error","Fotografía Wi-Fi: "+e.Message);}
                }
                if((DateTime.UtcNow-last).TotalSeconds>10)
                {
                    last=DateTime.UtcNow;
                    // Verifica que la conexión aún responde, sin disparar ni modificar ajustes.
                    try {await camera.DrainEventsAsync(cts.Token);}
                    catch(Exception ex){throw new IOException("Wi-Fi desconectado: "+ex.Message,ex);}
                }
                await Task.Delay(40,cts.Token);
            }
            return 0;
        }
        catch(OperationCanceledException){Emit("error","La apertura de sesión Canon Wi-Fi excedió 35 segundos. Revisa las últimas operaciones PTP/IP del diagnóstico.");return 4;}
        catch(Exception ex){Emit("error","Handshake PTP/IP falló: "+ex.GetType().Name+": "+ex.Message);return 1;}
    }
}
