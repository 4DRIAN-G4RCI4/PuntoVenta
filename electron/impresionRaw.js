const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

// Envía bytes en crudo (tipo RAW) a una impresora de Windows vía la API
// winspool, saltándose el driver — así el "Generic / Text Only" no
// destruye el formato ESC/POS. El nombre de la impresora va como argumento,
// nunca concatenado al script.
const PS_IMPRIMIR_RAW = `param([string]$impresora, [string]$archivo)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class RawPrn {
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
[DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
[DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
[DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern int StartDocPrinter(IntPtr h, int nivel, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
[DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
[DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
[DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
[DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int escritos);
public static void Enviar(string impresora, byte[] datos) {
  IntPtr h;
  if (!OpenPrinter(impresora, out h, IntPtr.Zero)) throw new Exception("No se pudo abrir la impresora: " + impresora);
  try {
    DOCINFO di = new DOCINFO(); di.pDocName = "Ticket"; di.pDataType = "RAW";
    if (StartDocPrinter(h, 1, di) == 0) throw new Exception("La impresora rechazo el trabajo.");
    StartPagePrinter(h);
    int escritos;
    bool okEscritura = WritePrinter(h, datos, datos.Length, out escritos);
    EndPagePrinter(h);
    EndDocPrinter(h);
    if (!okEscritura || escritos != datos.Length) throw new Exception("No se enviaron todos los datos a la impresora.");
  } finally { ClosePrinter(h); }
}
}
"@
[RawPrn]::Enviar($impresora, [System.IO.File]::ReadAllBytes($archivo))
`;

function imprimirRaw(impresora, datos) {
  const base = path.join(os.tmpdir(), `pvp-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const script = base + '.ps1';
  const archivo = base + '.bin';
  fs.writeFileSync(script, PS_IMPRIMIR_RAW, 'utf-8');
  fs.writeFileSync(archivo, datos);
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, impresora, archivo],
      { windowsHide: true, timeout: 30000 },
      (error, _stdout, stderr) => {
        try { fs.unlinkSync(script); } catch (_e) {}
        try { fs.unlinkSync(archivo); } catch (_e) {}
        resolve(error ? (String(stderr).trim().split('\n')[0] || error.message) : null);
      });
  });
}

module.exports = { imprimirRaw };
