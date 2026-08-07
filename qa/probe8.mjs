import { findMatches, determineSpecials } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/engine/BoardEngine.js';
import { COLS, ROWS, SPECIAL } from 'file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/constants/kural.js';
const NAME = { 0:'YOK',1:'CIZGILI_H',2:'CIZGILI_V',3:'SARMAL',4:'RENK_BOMBASI' };
let n=0; const mk=(f)=>{const g=[];for(let c=0;c<COLS;c++){g[c]=[];for(let r=0;r<ROWS;r++)g[c][r]={type:f(c,r),special:SPECIAL.NONE,id:'q'+(n++)};}return g;};
const base=(c,r)=>(c+2*r)%6;
// yatay 5 (r=4, c=2..6) + dikey 3 (c=4, r=2..4) ayni tip -> T sekli
const g = mk((c,r)=> ((r===4&&c>=2&&c<=6)||(c===4&&r>=2&&r<=4))?0:base(c,r));
const {matchGroups} = findMatches(g);
console.log('gruplar:', matchGroups.map(x=>x.direction+':'+x.cells.length).join(', '));
console.log('determineSpecials ->', determineSpecials(matchGroups).map(s=>NAME[s.special]).join(', '));
console.log('BEKLENEN (Candy Crush kurali): 5-li dizi RENK_BOMBASI vermeli');
