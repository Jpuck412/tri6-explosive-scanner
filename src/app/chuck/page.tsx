import { analyzeWithChuck } from "@/lib/chuck-engine";

const demo = [
  analyzeWithChuck({ symbol:"PPCB", price:3.86, gainPct:260, volume:25000000, relativeVolume:90, volumeAcceleration:1.7, speedScore:78, spreadPct:0.4, buyerControl:72, supportStrength:68, riskDefined:true, oneCandleConfirmed:true, catalystScore:92, dilutionRisk:55, p905:4.14, open930:3.51, high935:4.13, close940:3.86 }),
  analyzeWithChuck({ symbol:"VNRX", price:0.6412, gainPct:88, volume:120000000, relativeVolume:100, volumeAcceleration:2.2, speedScore:84, spreadPct:0.35, buyerControl:70, supportStrength:66, riskDefined:true, oneCandleConfirmed:true, catalystScore:70, dilutionRisk:45, p905:0.64, open930:0.6476, high935:0.72, close940:0.6412 }),
  analyzeWithChuck({ symbol:"MERC", price:0.6218, gainPct:50, volume:25000000, relativeVolume:40, volumeAcceleration:0.8, speedScore:44, spreadPct:0.8, buyerControl:39, supportStrength:38, riskDefined:false, oneCandleConfirmed:false, catalystScore:72, dilutionRisk:30, p905:0.68, open930:0.6421, high935:0.644, close940:0.6218 }),
].sort((a,b)=>b.score-a.score);

function pct(n?: number){return n==null?"—":`${n.toFixed(1)}%`;}

export default function ChuckPage(){
  return <main style={{minHeight:"100vh",background:"radial-gradient(circle at top,#172033 0,#090d16 48%,#05070b 100%)",color:"#f8fafc",padding:"24px",fontFamily:"Arial,sans-serif"}}>
    <div style={{maxWidth:1180,margin:"0 auto"}}>
      <section style={{display:"flex",justifyContent:"space-between",gap:18,alignItems:"end",flexWrap:"wrap",marginBottom:24}}>
        <div><div style={{fontSize:12,letterSpacing:3,opacity:.65}}>EXECUTIVE MARKET DECISION ENGINE</div><h1 style={{fontSize:52,lineHeight:1,margin:"8px 0"}}>CHUCK</h1><div style={{opacity:.75}}>Evidence &gt; prediction. No proof = no trade.</div></div>
        <div style={{padding:"10px 14px",border:"1px solid #334155",borderRadius:14,background:"rgba(15,23,42,.75)"}}>9:05 → 9:30 Validation Engine</div>
      </section>

      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:20}}>
        {["Speed + Volume Acceleration","Spread + Liquidity","Buyer Control + Support","Catalyst + Dilution Context"].map(x=><div key={x} style={{padding:18,borderRadius:18,border:"1px solid #263245",background:"linear-gradient(145deg,rgba(30,41,59,.88),rgba(8,15,26,.88))",boxShadow:"0 18px 40px rgba(0,0,0,.22)"}}><div style={{fontWeight:800}}>{x}</div></div>)}
      </section>

      <section style={{display:"grid",gap:14}}>
        {demo.map((r,i)=><article key={r.symbol} style={{padding:20,borderRadius:22,border:"1px solid #2a3850",background:"linear-gradient(145deg,rgba(17,24,39,.95),rgba(7,11,20,.95))",boxShadow:"0 24px 60px rgba(0,0,0,.28)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div><span style={{fontSize:13,opacity:.55}}>#{i+1}</span> <strong style={{fontSize:30,marginLeft:8}}>{r.symbol}</strong><span style={{marginLeft:12,opacity:.7}}>{r.regime.replaceAll("_"," ")}</span></div>
            <div style={{fontSize:26,fontWeight:900}}>{r.score.toFixed(1)} <span style={{fontSize:13,opacity:.6}}>/ 100</span></div>
          </div>
          <div style={{margin:"14px 0",fontWeight:900,letterSpacing:1}}>{r.verdict}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,fontSize:14}}>
            <div>9:30 retention<br/><b>{pct(r.openRetention)}</b></div><div>9:05 reclaim<br/><b>{pct(r.reclaimStrength)}</b></div><div>Open expansion<br/><b>{pct(r.postOpenExpansion)}</b></div><div>Expansion retained<br/><b>{pct(r.expansionRetention)}</b></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14,marginTop:16}}>
            <div><b>PROOF</b><div style={{opacity:.72,marginTop:6}}>{r.reasons.join(" • ") || "None yet"}</div></div>
            <div><b>FAILURES</b><div style={{opacity:.72,marginTop:6}}>{r.failures.join(" • ") || "None"}</div></div>
          </div>
        </article>)}
      </section>
    </div>
  </main>
}
