import { importGabc } from '../editor/interchange/gabc';

/** A short editable specimen showing every supported neume shape. */
export const demoDocument = importGabc(`name: Kyrie eleison;
language: Latin;
%%
(c4) Ky(f)ri(gh)e(gfg) e(gf)lé(ghi)i(hGF)son(hfh)
`);
