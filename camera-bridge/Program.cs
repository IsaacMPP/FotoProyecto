using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Collections.Generic;

internal static class Program
{
    private const uint ObjectAll = 0x00000200;
    private const uint TransferRequest = 0x00000208;
    private const uint SaveToProp = 0x0000000B;
    private const uint SaveToBoth = 3;
    private const int GalleryLimit = 30;
    private static IntPtr camera, cameraList;
    private static bool initialized, session;
    private static string output = "";
    private static EDSDK.ObjectHandler? handler;
    private static readonly object consoleLock = new();
    private static readonly List<(string name, uint date, IntPtr item)> gallery = new();
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
                Download(item);
            }
        }
        catch(Exception ex) { Emit("error", "Transferencia: " + ex.Message); try { EDSDK.EdsDownloadCancel(item); }catch{} }
        finally { EDSDK.EdsRelease(item); }
        return 0;
    }
    private static void Download(IntPtr item,string prefix="")
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
            Emit("photo",target);
        }
        finally { EDSDK.EdsRelease(stream); }
    }
    private static void CollectGallery(IntPtr parent, int depth)
    {
        if(depth > 5) return;
        uint err=EDSDK.EdsGetChildCount(parent,out var count);
        if(err!=0) {Emit("error","No se pudo leer carpeta de cámara (0x"+err.ToString("X8")+")");return;}
        for(int i=0;i<count;i++)
        {
            IntPtr item=IntPtr.Zero;
            try
            {
                Check(EDSDK.EdsGetChildAtIndex(parent,i,out item),"EdsGetChildAtIndex(galería)");
                if(EDSDK.EdsGetDirectoryItemInfo(item,out var info)!=0) {
                    // Camera volumes do not expose directory item info.
                    CollectGallery(item,depth+1);
                }
                else if(info.isFolder)
                    CollectGallery(item,depth+1);
                else if(info.fileName!=null &&
                        (info.fileName.EndsWith(".jpg",StringComparison.OrdinalIgnoreCase) ||
                         info.fileName.EndsWith(".jpeg",StringComparison.OrdinalIgnoreCase)))
                {
                    gallery.Add((info.fileName,info.dateTime,item));
                    item=IntPtr.Zero;
                }
            }
            catch(Exception ex) {Emit("error","Explorando tarjeta: "+ex.Message);}
            finally {if(item!=IntPtr.Zero)EDSDK.EdsRelease(item);}
        }
    }
    private static void ImportGallery()
    {
        try
        {
            gallery.Clear();
            CollectGallery(camera,0);
            int total=gallery.Count;
            Emit("status",$"Canon conectada. Galería detectada: {total} fotos JPG. Importando últimas {Math.Min(total,GalleryLimit)}...");
            var ordered=gallery.OrderBy(p=>p.date).ThenBy(p=>p.name,StringComparer.OrdinalIgnoreCase).ToList();
            var latest=ordered.TakeLast(GalleryLimit).ToList();
            int importedCount=0;
            foreach(var photo in latest)
            {
                try
                {
                    string target=Path.Combine(output,"Canon_"+photo.name);
                    if(!File.Exists(target)) { Download(photo.item,"Canon_"); importedCount++; }
                }
                catch(Exception ex) {Emit("error","Galería "+photo.name+": "+ex.Message);}
                finally { EDSDK.EdsRelease(photo.item);gallery.Remove(photo); }
                EDSDK.EdsGetEvent();
            }
            foreach(var photo in gallery) EDSDK.EdsRelease(photo.item);
            gallery.Clear();
            Emit("status",$"Canon conectada por USB. {total} JPEG encontrados; {importedCount} importados. Nuevos disparos activos.");
        }
        catch(Exception ex) {Emit("error","No se pudo listar galería: "+ex.Message);}
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
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsDownloadCancel(IntPtr item);
    [DllImport("EDSDK.dll",CallingConvention=CallingConvention.StdCall)] public static extern uint EdsGetEvent();
}
