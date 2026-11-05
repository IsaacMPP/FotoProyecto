using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Collections.Generic;
using System.Diagnostics;

internal static class Program
{
    private const uint ObjectAll = 0x00000200;
    private const uint TransferRequest = 0x00000208;
    private const uint SaveToProp = 0x0000000B;
    private const uint SaveToBoth = 3;
    private const int FullJpegLimit = 30; // older JPEGs use camera previews for faster gallery loading
    private static IntPtr camera, cameraList;
    private static bool initialized, session;
    private static string output = "";
    private static EDSDK.ObjectHandler? handler;
    private static readonly object consoleLock = new();
    private static readonly List<(string name, uint date, IntPtr item, bool raw)> gallery = new();
    private static int folderCount=0,jpegCount=0,rawCount=0,otherCount=0;
    private static int running = 1;

    private static void Emit(string type, string message)
    {
        lock (consoleLock)
            Console.WriteLine(JsonSerializer.Serialize(new {type, message}));
    }
    private static void Check(uint error, string name)
    {
        if(error != 0) throw new Exception(name + " devolvió 0x" + error.ToString("X8"));
    }
    private static uint OnObject(uint evt, IntPtr item, IntPtr context)
    {
        if(item == IntPtr.Zero) return 0;
        try
        {
            if(evt == TransferRequest)
            {
                Check(EDSDK.EdsGetDirectoryItemInfo(item,out var taken),"EdsGetDirectoryItemInfo(captura)");
                string ext=Path.GetExtension(taken.fileName??"").ToUpperInvariant();
                if(ext==".CR2" || ext==".CR3")
                {
                    string filename="Canon_"+taken.dateTime+"_"+Path.GetFileNameWithoutExtension(taken.fileName)+".jpg";
                    try{DownloadPreview(item,Path.Combine(output,filename),taken.dateTime);}
                    catch(Exception e){Emit("error","Miniatura RAW de cámara no disponible: "+e.Message);}
                    string rawPath=Download(item,"",true,taken.dateTime);
                    if(!File.Exists(Path.Combine(output,filename)) && !ExtractRawPreview(rawPath,Path.Combine(output,filename),taken.dateTime))
                        Emit("error","No se pudo generar JPEG de "+taken.fileName+"; RAW guardado sin cambios.");
                }
                else Download(item,"",true,taken.dateTime);
            }
        }
        catch(Exception ex) { Emit("error", "Transferencia: " + ex.Message); try { EDSDK.EdsDownloadCancel(item); }catch{} }
        finally { EDSDK.EdsRelease(item); }
        return 0;
    }
    private static string Download(IntPtr item,string prefix="", bool transferRequest=true, uint cameraDate=0)
    {
        Check(EDSDK.EdsGetDirectoryItemInfo(item, out var info), "EdsGetDirectoryItemInfo");
        var original = prefix+Path.GetFileName(info.fileName);
        if(string.IsNullOrWhiteSpace(original)) original = "Canon_" + DateTime.Now.ToString("yyyyMMdd_HHmmssfff") + ".jpg";
        string target = Path.Combine(output, original);
        if(File.Exists(target))
        {
            string name = Path.GetFileNameWithoutExtension(original), ext=Path.GetExtension(original);
            target = Path.Combine(output, name + "_" + DateTime.Now.ToString("HHmmssfff") + ext);
        }
        uint err = EDSDK.EdsCreateFileStream(target,1,2,out var stream);
        Check(err,"EdsCreateFileStream");
        try
        {
            Check(EDSDK.EdsDownload(item,info.size,stream),"EdsDownload");
            Check(EDSDK.EdsDownloadComplete(item),"EdsDownloadComplete");
            PreserveDate(target,cameraDate);
            Emit("photo",target);
        }
        finally { EDSDK.EdsRelease(stream); }
        return target;
    }

    private static void PreserveDate(string file,uint cameraDate)
    {
        if(cameraDate<946684800 || cameraDate>4102444800) return;
        try {File.SetLastWriteTimeUtc(file,DateTimeOffset.FromUnixTimeSeconds(cameraDate).UtcDateTime);}
        catch(Exception ex){Emit("error","Fecha: "+ex.Message);}
    }
    private static void DownloadPreview(IntPtr item,string target,uint cameraDate)
    {
        Check(EDSDK.EdsCreateFileStream(target,1,2,out var stream),"EdsCreateFileStream(vista previa)");
        try {Check(EDSDK.EdsDownloadThumbnail(item,stream),"EdsDownloadThumbnail");}
        catch {try{File.Delete(target);}catch{} throw;}
        finally {EDSDK.EdsRelease(stream);}
        if(!IsJpeg(target)) {try{File.Delete(target);}catch{} throw new Exception("Canon entregó miniatura no JPEG");}
        PreserveDate(target,cameraDate);
        Emit("photo",target);
    }
    private static bool IsJpeg(string file)
    {
        try {using var fs=File.OpenRead(file);return fs.Length>512&&fs.ReadByte()==255&&fs.ReadByte()==216;}
        catch{return false;}
    }
    // Extrae el JPEG incrustado en CR2/CR3 sin alterar el original.
    private static bool ExtractRawPreview(string rawPath,string target,uint date)
    {
        string exe=Path.Combine(AppContext.BaseDirectory,"exiftool.exe");
        if(!File.Exists(exe)) {Emit("error","Falta herramienta JPEG RAW integrada (ExifTool).");return false;}
        foreach(string tag in new[]{"JpgFromRaw","PreviewImage","OtherImage","ThumbnailImage"})
        {
            try
            {
                string temporary=target+".partial";
                using(var process=new Process())
                {
                    process.StartInfo.FileName=exe;
                    process.StartInfo.UseShellExecute=false;
                    process.StartInfo.CreateNoWindow=true;
                    process.StartInfo.RedirectStandardOutput=true;
                    process.StartInfo.Arguments="-b -"+tag+" \""+rawPath.Replace("\"","")+"\"";
                    if(!process.Start())continue;
                    using(var dest=File.Create(temporary)){process.StandardOutput.BaseStream.CopyTo(dest);}
                    if(!process.WaitForExit(15000)){process.Kill(true);Emit("error","Tiempo agotado extrayendo "+tag);continue;}
                    if(process.ExitCode==0&&IsJpeg(temporary))
                    {
                        File.Move(temporary,target,true);
                        PreserveDate(target,date);Emit("photo",target);return true;
                    }
                }
                if(File.Exists(temporary))File.Delete(temporary);
            }
            catch(Exception ex){Emit("error","Extracción "+tag+": "+ex.Message);}
        }
        return false;
    }
    private static void CollectGallery(IntPtr parent,int depth)
    {
        if(depth>12) {Emit("error","Se alcanzó el límite de niveles de carpetas");return;}
        uint err=EDSDK.EdsGetChildCount(parent,out var count);
        if(err!=0){Emit("error","No se pudo explorar una carpeta de la tarjeta: 0x"+err.ToString("X8"));return;}
        for(int i=0;i<count;i++)
        {
            IntPtr item=IntPtr.Zero;
            try
            {
                Check(EDSDK.EdsGetChildAtIndex(parent,i,out item),"EdsGetChildAtIndex(galería)");
                if(EDSDK.EdsGetDirectoryItemInfo(item,out var info)!=0)
                {
                    // Volúmenes de tarjeta SD (no son archivos).
                    CollectGallery(item,depth+1);
                }
                else if(info.isFolder)
                {
                    folderCount++;
                    CollectGallery(item,depth+1);
                }
                else
                {
                    string ext=Path.GetExtension(info.fileName??"").ToUpperInvariant();
                    bool raw=ext==".CR2"||ext==".CR3";
                    bool jpeg=ext==".JPG"||ext==".JPEG";
                    if(jpeg||raw)
                    {
                        if(raw)rawCount++;else jpegCount++;
                        gallery.Add((info.fileName,info.dateTime,item,raw));
                        item=IntPtr.Zero;
                    }
                    else otherCount++;
                }
            }
            catch(Exception ex){Emit("error","Explorando tarjeta: "+ex.Message);}
            finally{if(item!=IntPtr.Zero)EDSDK.EdsRelease(item);}
        }
    }
    private static void ImportGallery()
    {
        try
        {
            gallery.Clear();
            folderCount=jpegCount=rawCount=otherCount=0;
            CollectGallery(camera,0);
            int total=gallery.Count;
            Emit("status",$"Tarjeta: {folderCount} carpetas, {jpegCount} JPEG, {rawCount} RAW, {otherCount} otros. Preparando galería...");
            if(total==0){Emit("status","Canon conectada. No se encontraron JPEG ni RAW en la tarjeta. Nuevos disparos activos.");return;}
            // Si existen dos archivos RAW+JPEG del mismo disparo, preferir JPEG para previsualizar.
            var sorted=gallery.OrderBy(p=>p.date==0?uint.MaxValue:p.date)
                .ThenBy(p=>p.name,StringComparer.OrdinalIgnoreCase).ToList();
            var selected=sorted
                .GroupBy(p=>(p.date,Path.GetFileNameWithoutExtension(p.name).ToUpperInvariant()))
                .Select(g=>g.OrderBy(p=>p.raw?1:0).First())
                .ToList();
            int loaded=0,failed=0;
            var newestFull=selected.TakeLast(FullJpegLimit).ToHashSet();
            for(int i=0;i<selected.Count;i++)
            {
                var photo=selected[i];
                try
                {
                    string stem=Path.GetFileNameWithoutExtension(photo.name);
                    // Identificador estable que conserva orden y evita colisiones entre carpetas.
                    string target=Path.Combine(output,"Canon_"+photo.date+"_"+stem+".jpg");
                    if(!File.Exists(target))
                    {
                        if(!photo.raw && newestFull.Contains(photo))
                        {
                            // Para las últimas JPEG descargamos resolución completa.
                            Download(photo.item,"Canon_"+photo.date+"_",false,photo.date);
                        }
                        else
                        {
                            // RAW: extraemos su vista JPEG. Para JPEG antiguas también aceleramos la galería.
                            try {DownloadPreview(photo.item,target,photo.date);}
                            catch(Exception thumbnailError)
                            {
                                Emit("status","Usando método alternativo para "+photo.name);
                                if(photo.raw)
                                {
                                    string filename="Original_"+photo.date+"_"+photo.name;
                                    string rawPath=Path.Combine(output,filename);
                                    if(!File.Exists(rawPath))rawPath=Download(photo.item,"Original_"+photo.date+"_",false,photo.date);
                                    if(!ExtractRawPreview(rawPath,target,photo.date))
                                        throw new Exception("Sin vista JPEG incrustada: "+thumbnailError.Message);
                                }
                                else Download(photo.item,"Canon_"+photo.date+"_",false,photo.date);
                            }
                        }
                    }
                    else PreserveDate(target,photo.date);
                    // Corrige el orden de versiones anteriores sin borrar ninguna foto.
                    string legacy=Path.Combine(output,"Canon_"+photo.name);
                    if(File.Exists(legacy))PreserveDate(legacy,photo.date);
                    loaded++;
                }
                catch(Exception ex){failed++;Emit("error","Importando "+photo.name+": "+ex.Message);}
                if(i==0 || (i+1)%20==0)Emit("status",$"Galería: {i+1}/{selected.Count} fotografías procesadas ({jpegCount} JPEG, {rawCount} RAW en tarjeta).");
                EDSDK.EdsGetEvent();
            }
            Emit("status",$"Canon USB conectada. Tarjeta: {jpegCount} JPEG y {rawCount} RAW en {folderCount} carpetas. Galería: {loaded} fotografías; {failed} errores. Nuevos disparos activos.");
        }
        catch(Exception ex){Emit("error","Error leyendo galería: "+ex.Message);}
        finally
        {
            foreach(var photo in gallery)try{EDSDK.EdsRelease(photo.item);}catch{}
            gallery.Clear();
        }
    }
    public static int Main(string[] args)
    {
        if(args.Length == 0) {Emit("error","Falta carpeta de destino");return 2;}
        output=Path.GetFullPath(args[0]);
        Directory.CreateDirectory(output);
        Console.CancelKeyPress += (_,e) => {e.Cancel=true;Interlocked.Exchange(ref running,0);};
        try
        {
            Check(EDSDK.EdsInitializeSDK(),"EdsInitializeSDK");
            initialized=true;
            Check(EDSDK.EdsGetCameraList(out cameraList),"EdsGetCameraList");
            Check(EDSDK.EdsGetChildCount(cameraList,out var count),"EdsGetChildCount");
            if(count == 0) throw new Exception("No se encontró cámara Canon. Conecta USB y cierra otras aplicaciones que usen la cámara.");
            Check(EDSDK.EdsGetChildAtIndex(cameraList,0,out camera),"EdsGetChildAtIndex");
            Check(EDSDK.EdsOpenSession(camera),"EdsOpenSession");session=true;
            handler = OnObject;
            Check(EDSDK.EdsSetObjectEventHandler(camera,ObjectAll,handler,IntPtr.Zero),"EdsSetObjectEventHandler");
            uint dest=SaveToBoth;
            Check(EDSDK.EdsSetPropertyData(camera,SaveToProp,0,4,ref dest),"EdsSetPropertyData(SaveToBoth)");
            var capacity = new EDSDK.Capacity {numberOfFreeClusters=0x7FFFFFFF,bytesPerSector=4096,reset=1};
            Check(EDSDK.EdsSetCapacity(camera,capacity),"EdsSetCapacity");
            ImportGallery();
            while(Volatile.Read(ref running)==1)
            {
                EDSDK.EdsGetEvent();
                Thread.Sleep(100);
            }
            return 0;
        }
        catch(DllNotFoundException) {Emit("error","Falta EDSDK.dll de Canon. Solicita el SDK oficial y copia sus DLL x64 junto a DemiCameraBridge.exe.");return 3;}
        catch(BadImageFormatException) {Emit("error","El SDK Canon no es x64 o es incompatible.");return 4;}
        catch(Exception ex){Emit("error",ex.Message);return 1;}
        finally
        {
            try{if(session)EDSDK.EdsCloseSession(camera);}catch{}
            try{if(camera!=IntPtr.Zero)EDSDK.EdsRelease(camera);}catch{}
            try{if(cameraList!=IntPtr.Zero)EDSDK.EdsRelease(cameraList);}catch{}
            try{if(initialized)EDSDK.EdsTerminateSDK();}catch{}
        }
    }
}
internal static class EDSDK
{
    // Canon EDSDK: DLL x64 must be obtained from Canon Developer Community.
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate uint ObjectHandler(uint evt, IntPtr reference, IntPtr context);
    [StructLayout(LayoutKind.Sequential)]
    public struct Capacity { public int numberOfFreeClusters;public int bytesPerSector;public int reset; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public struct DirectoryItemInfo
    {
        public ulong size;
        [MarshalAs(UnmanagedType.Bool)] public bool isFolder;
        public uint groupId;
        public uint option;
        [MarshalAs(UnmanagedType.ByValTStr,SizeConst=256)] public string fileName;
        public uint format;
        public uint dateTime;
    }
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsInitializeSDK();
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsTerminateSDK();
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetCameraList(out IntPtr list);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetChildCount(IntPtr list,out uint count);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetChildAtIndex(IntPtr list,int index,out IntPtr camera);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsOpenSession(IntPtr camera);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsCloseSession(IntPtr camera);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsRelease(IntPtr value);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsSetObjectEventHandler(IntPtr camera,uint evt,ObjectHandler callback,IntPtr context);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsSetPropertyData(IntPtr camera,uint id,int param,uint size,ref uint data);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsSetCapacity(IntPtr camera,Capacity capacity);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetDirectoryItemInfo(IntPtr item,out DirectoryItemInfo info);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall,CharSet=CharSet.Ansi)] public static extern uint EdsCreateFileStream(string path,uint disposition,uint access,out IntPtr stream);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsDownload(IntPtr item,ulong size,IntPtr stream);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsDownloadComplete(IntPtr item);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsDownloadThumbnail(IntPtr item,IntPtr stream);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsDownloadCancel(IntPtr item);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetEvent();
}
