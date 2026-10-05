const { pathToFileURL } = require('node:url');
const entry = process.argv[2];
process.argv = [process.execPath, entry, ...process.argv.slice(3)];
// Do not leave servers running if the desktop process crashes or is force-closed.
process.on('disconnect', () => process.exit(0));
import(pathToFileURL(entry).href).catch(error => { console.error(error); process.exit(1); });
