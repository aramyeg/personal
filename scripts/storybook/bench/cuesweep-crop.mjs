import sharp from 'sharp'
const [,, src, l, t, w, h, out] = process.argv
await sharp(src).extract({ left: +l, top: +t, width: +w, height: +h }).resize({ width: 1200 }).png().toFile(out)
console.log('crop', out)
