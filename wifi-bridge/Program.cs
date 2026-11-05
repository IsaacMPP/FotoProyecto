using FC.SDK;
using FC.SDK.Canon;
using System.Collections.Concurrent;
using System.Text.Json;

internal static class Program
{
    private static readonly object Gate = new();
    private static void Emit(string type,string message)
    { lock(Gate) Console.WriteLine(JsonSerializer.Serialize(new { type, message })); }
    private static readonly ConcurrentQueue<uint> Items = new();
    private static bool IsJpeg(byte[] bytes) => bytes.Length > 512 && bytes[0] == 255 && bytes[1] == 216;
    public static async Task<int> Main(string[] args)
    {
        if(args.Length < 2 || !System.Net.IPAddress.TryParse(args[0],out var parsed) ||
           !System.Net.IPAddress.IsLoopback(parsed) && parsed.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
        { Emit("error","Dirección IP Wi-Fi inválida"); return 2; }
        var ip=args[0];
        string output=Path.GetFullPath(args[1]);
        Directory.CreateDirectory(output);
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;cts.Cancel();};
        try
        {
            await using var camera = CanonCamera.ConnectWifi(ip,"Demi Tether Studio");
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var result=await camera.OpenSessionAsync(timeout.Token);
            if(result != EdsError.OK) throw new Exception("No se pudo abrir sesión Wi-Fi: "+result);
            camera.ObjectAdded+=(_,e)=> Items.Enqueue(e.ObjectHandle);
            camera.StartEventPolling(TimeSpan.FromMilliseconds(250));
            try
            {
                var save=await camera.SetSaveToAsync(EdsSaveTo.Both,cts.Token);
                if(save!=EdsError.OK) Emit("error","No se pudo seleccionar guardar en tarjeta y PC ("+save+"). Se escucharán eventos disponibles.");
            } catch(Exception ex) { Emit("error","Destino de captura: "+ex.Message); }
            Emit("status","Canon conectada por Wi-Fi ("+ip+"). Recepción de nuevos disparos activa.");
            var last=DateTime.UtcNow;
            while(!cts.IsCancellationRequested)
            {
                while(Items.TryDequeue(out var handle))
                {
                    try
                    {
                        var (_,name)=await camera.GetObjectFileNameAsync(handle,cts.Token);
                        name=Path.GetFileName(name);
                        if(string.IsNullOrWhiteSpace(name))name="Canon_"+DateTime.UtcNow.ToString("yyyyMMdd_HHmmssfff")+".jpg";
                        var ext=Path.GetExtension(name).ToUpperInvariant();
                        string unique=DateTime.UtcNow.ToString("yyyyMMdd_HHmmssfff")+"_"+name;
                        if(ext==".CR2"||ext==".CR3")
                        {
                            var (err,thumb)=await camera.GetThumbAsync(handle,cts.Token);
                            if(err==EdsError.OK && IsJpeg(thumb))
                            {
                                string jpg=Path.Combine(output,Path.GetFileNameWithoutExtension(unique)+".jpg");
                                await File.WriteAllBytesAsync(jpg,thumb,cts.Token);
                                Emit("photo",jpg);
                            }
                        }
                        string file=Path.Combine(output,unique);
                        await using(var stream=File.Create(file))
                        {
                            var err=await camera.DownloadAsync(handle,stream,cts.Token);
                            if(err!=EdsError.OK)throw new Exception("Descarga: "+err);
                        }
                        var complete=await camera.TransferCompleteAsync(handle,cts.Token);
                        if(complete!=EdsError.OK)Emit("error","TransferComplete: "+complete);
                        Emit("photo",file);
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
                await Task.Delay(180,cts.Token);
            }
            return 0;
        }
        catch(OperationCanceledException){return 0;}
        catch(Exception ex){Emit("error","Conexión Wi-Fi: "+ex.Message);return 1;}
    }
}
