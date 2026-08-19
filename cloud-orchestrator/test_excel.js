const xlsx = require('xlsx');
const workbook = xlsx.readFile('/Users/cortex/ventures/tokiyo-edge-automation/docs/dumb-data/AggregateAnalytics_Anuj Kumar_2026-08-06_2026-08-12.xlsx');
const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
const links = data.filter(row => row['Post link']).map(row => row['Post link']);
console.log('Post Links:', links.slice(0, 10));
if (links.length === 0) {
    console.log(data.slice(0, 5));
}
