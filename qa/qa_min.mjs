const B='file:///C:/Users/PC/Projects/claude-mobile-terminal-5/workspace/gurbuzer1_candy1/src/';
const {createBoard,removeAndCollapse,placeSpecials}=await import(B+'engine/BoardEngine.js');
const {COLS,ROWS,SPECIAL}=await import(B+'constants/kural.js');
let min=99,N=5000;
for(let i=0;i<N;i++){const g=createBoard();const k=[0,0,0,0,0,0];
 for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++)k[g[c][r].type]++;
 const mx=Math.max(...k); if(mx<min)min=mx;}
console.log(`${N} createBoard tahtasinda EN KALABALIK rengin MINIMUMU = ${min} (esik 14). ceil(81/6)=14 -> guvercin yuvasi kesin.`);
// placeSpecials gercekten yerlestiriyor mu?
const g=createBoard(); const m=new Set(['0,0','0,1','0,2','0,3']);
const {grid:col}=removeAndCollapse(g,m);
const nulls=col.flat().filter(x=>x===null).length;
const before=col.flat().filter(x=>x.special!==SPECIAL.NONE).length;
const after=placeSpecials(col,[{col:0,row:1,type:2,special:SPECIAL.STRIPED_H}]).flat().filter(x=>x.special!==SPECIAL.NONE).length;
console.log(`removeAndCollapse sonrasi null hucre: ${nulls} | placeSpecials once ozel=${before}, sonra ozel=${after} -> ${after>before?'yerlestirdi':'NO-OP (eslesmeden dogan ozel tahtaya HIC KONMUYOR)'}`);
