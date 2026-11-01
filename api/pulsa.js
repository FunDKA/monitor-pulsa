import * as cheerio from 'cheerio';

const URL_VAS = 'http://36.67.65.202:8080/h2h/';
const URL_MASTERLOAD = 'https://masterload8.cekreport.com/harga.js.php?id=8b9b44483ff39058552d3aaf7eae5ab00ffc67cd0ea30e1af0c944008f8405cb4d261958f0400a4031dc1a5e12544e41-633';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [resVas, resMl] = await Promise.allSettled([
      fetch(URL_VAS).then(r => r.text()),
      fetch(URL_MASTERLOAD).then(r => r.text())
    ]);

    const dataVas = [];
    const dataMasterload = [];

    if (resVas.status === 'fulfilled') {
      const $ = cheerio.load(resVas.value);
      const pulsaSection = $('#home').length ? $('#home') : $('h3:contains("PULSA")').parent();

      pulsaSection.find('b').each((_, el) => {
        const categoryName = $(el).text().trim();
        const table = $(el).nextAll('table').first();

        if (table.length && categoryName.startsWith('(')) {
          table.find('tbody tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 5) {
              const rawPrice = $(cols[2]).text().trim().replace(/\./g, '');
              dataVas.push({
                supplier: 'CV_VAS',
                kategori: categoryName,
                nama: $(cols[0]).text().trim(),
                kode: $(cols[1]).text().trim().toUpperCase(),
                harga: parseInt(rawPrice, 10) || 0,
                status: ($(cols[3]).text().trim().toLowerCase() === 'normal' && $(cols[4]).text().trim().toLowerCase() === 'tersedia') ? 'Normal' : 'Gangguan',
                ketStatus: `${$(cols[3]).text().trim()} / ${$(cols[4]).text().trim()}`
              });
            }
          });
        }
      });
    }

    if (resMl.status === 'fulfilled') {
      const $ml = cheerio.load(resMl.value);
      $ml('table').each((_, table) => {
        const rows = $ml(table).find('tr');
        if (rows.length < 2) return;

        const categoryName = $ml(rows[0]).text().trim();

        rows.each((idx, row) => {
          if (idx < 2) return;
          const cols = $ml(row).find('td');
          if (cols.length >= 4) {
            const kode = $ml(cols[0]).text().trim().toUpperCase();
            const nama = $ml(cols[1]).text().trim();
            const rawPrice = $ml(cols[2]).text().trim().replace(/\./g, '').replace(/,/g, '');
            const rawStatus = $ml(cols[3]).text().trim();

            if (kode && kode !== 'KODE') {
              dataMasterload.push({
                supplier: 'MASTERLOAD',
                kategori: categoryName,
                nama: nama,
                kode: kode,
                harga: parseInt(rawPrice, 10) || 0,
                status: rawStatus.toLowerCase().includes('open') ? 'Normal' : 'Gangguan',
                ketStatus: rawStatus
              });
            }
          }
        });
      });
    }

    return res.status(200).json({
      sukses: true,
      waktuUpdate: new Date().toISOString(),
      totalVas: dataVas.length,
      totalMasterload: dataMasterload.length,
      vas: dataVas,
      masterload: dataMasterload
    });
  } catch (error) {
    return res.status(500).json({
      sukses: false,
      pesan: 'Gagal mengambil data dari server H2H',
      detail: error.message
    });
  }
}