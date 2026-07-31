import { FALLBACK_CLASS } from './fallback-class'
import { PALETTE } from './palette'

/**
 * Pastel identity for the server-rendered fallback timeline.
 *
 * The fallback ships in the initial HTML (crawlable, and the real UI for
 * no-WebGL / reduced-motion visitors), but it used to carry NO styling of its
 * own — so during the ssr:false experience-chunk load window it inherited the
 * SITE theme (dark `--background`/light `--foreground`), showing as white career
 * text on a black page until the 3D scene took over. This gives it the lab's own
 * butter-cream→pink pastel skin so the pre-scene state reads as Small World, not
 * raw dark chrome. Once the scene is live, small-world-experience collapses this
 * element (its later rule wins), so these styles only ever paint pre-scene.
 *
 * Palette-only (spec tokens), hand-rolled to match the ?tune panel's no-new-dep
 * house style. Scoped entirely under `.${FALLBACK_CLASS}` so it can never leak.
 */
const S = `.${FALLBACK_CLASS}`

export const FALLBACK_STYLE = `
${S}{
  box-sizing:border-box;
  min-height:100dvh;
  margin:0;
  padding:clamp(3.5rem,8vh,6rem) clamp(1.25rem,5vw,3rem) 4rem;
  background:linear-gradient(180deg, ${PALETTE.sky} 0%, ${PALETTE.horizon} 100%);
  color:${PALETTE.ink};
  font-family:var(--sw-font-body), ui-sans-serif, system-ui, sans-serif;
  line-height:1.55;
  overflow-x:hidden;
}
${S} *{box-sizing:border-box;}
${S} > h1{
  max-width:56rem;
  margin:0 auto clamp(2rem,5vh,3rem);
  font-family:var(--sw-font-display), ui-sans-serif, system-ui, sans-serif;
  font-weight:700;
  font-size:clamp(1.9rem,4.5vw,3rem);
  line-height:1.1;
  letter-spacing:-0.01em;
  color:${PALETTE.leaf};
  text-wrap:balance;
}
${S} > ol{
  list-style:none;
  max-width:56rem;
  margin:0 auto;
  padding:0;
  display:grid;
  gap:clamp(1rem,2.5vh,1.75rem);
}
${S} > ol > li{
  background:${PALETTE.snow};
  border:1px solid ${PALETTE.horizon};
  border-left:5px solid ${PALETTE.clayPath};
  border-radius:16px;
  padding:clamp(1.1rem,3vw,1.75rem) clamp(1.25rem,3.5vw,2rem);
  box-shadow:0 6px 20px -12px ${PALETTE.ink}55;
}
${S} > ol > li > h2{
  margin:0 0 0.35rem;
  font-family:var(--sw-font-display), ui-sans-serif, system-ui, sans-serif;
  font-weight:600;
  font-size:clamp(1.15rem,2.6vw,1.5rem);
  line-height:1.2;
  color:${PALETTE.ink};
}
${S} > ol > li > p{margin:0.15rem 0;}
${S} > ol > li > p:first-of-type{
  color:${PALETTE.riverDeep};
  font-weight:600;
  font-size:0.95rem;
}
${S} > ol > li > ul{
  margin:0.75rem 0 0.75rem;
  padding-left:1.15rem;
}
${S} > ol > li > ul > li{margin:0.2rem 0;}
${S} > ol > li > p:last-child{
  margin-top:0.75rem;
  font-size:0.82rem;
  letter-spacing:0.02em;
  color:${PALETTE.leaf};
  font-weight:600;
}
${S} > footer{
  max-width:56rem;
  margin:clamp(2rem,5vh,3rem) auto 0;
  padding:clamp(1.1rem,3vw,1.75rem) clamp(1.25rem,3.5vw,2rem);
  border-radius:1rem;
  background:${PALETTE.snow}cc;
  box-shadow:0 6px 20px -12px ${PALETTE.ink}55;
}
${S} > footer > h2{
  margin:0 0 0.35rem;
  font-family:var(--sw-font-display), ui-sans-serif, system-ui, sans-serif;
  font-weight:700;
  font-size:clamp(1.15rem,2.6vw,1.5rem);
  color:${PALETTE.leaf};
}
${S} > footer > p{margin:0 0 0.85rem;}
${S} > footer > ul{
  display:flex;
  flex-wrap:wrap;
  gap:0.6rem 1.1rem;
  margin:0;
  padding:0;
  list-style:none;
}
${S} > footer a{
  color:${PALETTE.riverDeep};
  font-weight:700;
  text-decoration:underline;
  text-underline-offset:0.18em;
}
`
