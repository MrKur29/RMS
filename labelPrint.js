// ============================================================
// RPA Management System — Modul Cetak Label Standar (57×38mm)
// Dipakai bersama oleh: Boneless, Marinasi, Parting, ByProductKarkas, ProduksiKarkas
//
// STANDAR LAYOUT (semua modul harus sama):
//   - Ukuran fisik label: 57mm x 38mm
//   - Kiri  : QR code + kode (basket_code / label_code) di bawahnya
//   - Kanan : Nama Produk (besar & bold), Qty (ekor/bks), Kg,
//             Tgl Produksi, No Batch / No WO
//
// QR di-generate 100% LOKAL (offline) via QRCode.js (davidshimjs), TIDAK
// memanggil API online apapun. Isi QR HANYA kode keranjang/label (string
// polos), supaya saat discan tinggal lookup langsung by kode tsb.
//
// Halaman yang pakai modul ini WAJIB memuat QRCode.js lebih dulu:
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
//   <script src="labelPrint.js"></script>
//
// Kontrak data untuk buildStandardLabelHTML() / printStandardLabel():
//   {
//     code:       string  // basket_code / label_code — dicetak di bawah QR & jadi isi QR
//     namaProduk: string  // nama produk (tampil besar & bold)
//     qtyText:    string  // sudah diformat lengkap unit, mis. "120 ekor" / "45 bks"
//     kgText:     string  // sudah diformat lengkap unit, mis. "85.4 kg"
//     tglText:    string  // tanggal produksi, sudah diformat, mis. "04 Jul 2026"
//     refLabel:   string  // label baris terakhir, mis. "No WO" / "No Batch" / "Keterangan"
//     refValue:   string  // isi baris terakhir
//   }
// ============================================================
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Generate QR code sebagai data URL (base64 PNG) — 100% lokal, tanpa hit API online.
  function generateQRDataURL(text, sizePx) {
    sizePx = sizePx || 132;
    if (typeof QRCode === 'undefined') {
      console.error('labelPrint.js: library QRCode.js belum dimuat di halaman ini.');
      return '';
    }
    var holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
    document.body.appendChild(holder);
    var dataURL = '';
    try {
      new QRCode(holder, {
        text: String(text || ''),
        width: sizePx,
        height: sizePx,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      var canvas = holder.querySelector('canvas');
      var img = holder.querySelector('img');
      if (canvas) dataURL = canvas.toDataURL('image/png');
      else if (img) dataURL = img.src;
    } catch (e) {
      console.error('labelPrint.js: gagal generate QR lokal', e);
    } finally {
      document.body.removeChild(holder);
    }
    return dataURL;
  }

  // Bangun HTML label 57x38mm sesuai layout standar.
  function buildStandardLabelHTML(data) {
    data = data || {};
    var qrDataURL = generateQRDataURL(data.code, 132);
    var qrBlock = qrDataURL
      ? '<img src="' + qrDataURL + '" style="width:18mm;height:18mm;display:block">'
      : '<div style="width:18mm;height:18mm;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;font-size:5pt;color:#9ca3af;text-align:center;line-height:1.2">QR gagal dibuat</div>';

    return (
      '<div style="width:57mm;height:38mm;border:1px solid #000;border-radius:2px;' +
      'padding:1.5mm 2mm;font-family:Arial,sans-serif;background:#fff;display:flex;' +
      'gap:2mm;box-sizing:border-box">' +
      '<div style="flex-shrink:0;width:19mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.8mm">' +
      qrBlock +
      '<div style="font-size:6pt;font-weight:700;color:#000;text-align:center;line-height:1.15;word-break:break-all;max-width:19mm">' + esc(data.code) + '</div>' +
      '</div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;gap:1.1mm">' +
      '<div style="font-size:10.5pt;font-weight:900;color:#000;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(data.namaProduk) + '</div>' +
      '<div style="font-size:7.5pt;color:#000;font-weight:700">' + esc(data.qtyText) + '</div>' +
      '<div style="font-size:7.5pt;color:#000;font-weight:700">' + esc(data.kgText) + '</div>' +
      '<div style="font-size:6.5pt;color:#000;font-weight:600">Tgl Produksi: ' + esc(data.tglText) + '</div>' +
      '<div style="font-size:6.5pt;color:#000;font-weight:600">' + (data.refLabel ? esc(data.refLabel) + ': ' : '') + esc(data.refValue) + '</div>' +
      '</div>' +
      '</div>'
    );
  }

  // Buka window baru & langsung cetak label 57x38mm.
  function printStandardLabel(data) {
    data = data || {};
    var html = buildStandardLabelHTML(data);
    var win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Popup diblokir browser — izinkan popup untuk halaman ini agar bisa mencetak label.');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(data.code || 'Label') + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}' +
      'body{background:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh}' +
      '@page{size:57mm 38mm;margin:0}' +
      '@media print{body{min-height:auto;display:block}}' +
      '</style></head><body>' + html +
      '<script>window.onload=function(){window.print();window.close();}<' + '/script>' +
      '</body></html>'
    );
    win.document.close();
  }

  global.RPALabel = {
    generateQRDataURL: generateQRDataURL,
    buildStandardLabelHTML: buildStandardLabelHTML,
    printStandardLabel: printStandardLabel
  };
})(window);
