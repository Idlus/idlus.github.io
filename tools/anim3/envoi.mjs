// Envoi des images animées d'Idlus (sorties de convertir_diablofus.py) dans le stockage R2 de Diablofus, dossier idlus/
// (choix de Mathis du 12/11/2026). Servies ensuite par https://assets.diablofus.com/idlus/<h|m|fx>/<nom>-<anim>.webp
// Usage (sur un poste qui a les clés R2 de Diablofus) :
//   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… node tools/anim3/envoi.mjs <dossier anim3> <dépôt dofus-diablo> [--essai]
// Le SDK S3 est pris dans node_modules du dépôt Diablofus (déjà installé là-bas). N'envoie que ce qui manque ou a changé.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const [SRC, DD] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const essai = process.argv.includes('--essai');
if (!SRC || !DD) { console.error('Usage : node tools/anim3/envoi.mjs <dossier anim3> <dépôt dofus-diablo> [--essai]'); process.exit(1); }
const { R2_ACCOUNT_ID: compte, R2_ACCESS_KEY_ID: cle, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET } = process.env;
if (!compte || !cle || !secret) { console.error('Il manque R2_ACCOUNT_ID, R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY.'); process.exit(1); }
const BUCKET = R2_BUCKET || 'diablofus-assets', PREFIXE = 'idlus/';
const m = createRequire(join(DD, 'package.json'))('@aws-sdk/client-s3');
const s3 = new m.S3Client({ region: 'auto', endpoint: `https://${compte}.r2.cloudflarestorage.com`, credentials: { accessKeyId: cle, secretAccessKey: secret } });
const local = {};
for (const d of ['h', 'm', 'fx']) { let L = []; try { L = readdirSync(join(SRC, d)); } catch (e) { continue; }
  for (const f of L) if (f.endsWith('.webp')) local[`${PREFIXE}${d}/${f}`] = join(SRC, d, f); }
const distant = new Map(); let jeton;
do { const r = await s3.send(new m.ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIXE, ContinuationToken: jeton }));
  for (const o of r.Contents ?? []) distant.set(o.Key, (o.ETag ?? '').replaceAll('"', ''));
  jeton = r.IsTruncated ? r.NextContinuationToken : undefined; } while (jeton);
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
const liste = Object.keys(local).filter((k) => distant.get(k) !== md5(local[k]));
const octets = liste.reduce((s, k) => s + statSync(local[k]).size, 0);
console.log(`${Object.keys(local).length} images en local, ${distant.size} déjà sur R2, ${liste.length} à envoyer (${(octets / 1e6).toFixed(1)} Mo)`);
if (essai) { liste.slice(0, 20).forEach((k) => console.log('  ' + k)); process.exit(0); }
let i = 0, fait = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < liste.length) { const k = liste[i++];
  for (let n = 1; ; n++) { try { await s3.send(new m.PutObjectCommand({ Bucket: BUCKET, Key: k, Body: readFileSync(local[k]), ContentType: 'image/webp', CacheControl: 'public, max-age=86400' })); break; }
    catch (e) { if (n >= 4) throw e; await new Promise((r) => setTimeout(r, 2000 * n)); } }
  if (++fait % 100 === 0 || fait === liste.length) console.log(`  ${fait}/${liste.length}`); } }));
console.log('Envoi terminé. Pense à relancer tools/anim3/donnees.py pour que le jeu voie les nouvelles images.');
