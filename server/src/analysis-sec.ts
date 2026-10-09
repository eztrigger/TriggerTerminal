// Annual US-GAAP facts only: match duration, units and report end before computing ratios.
type Fact={val:number;start?:string;end:string;filed:string;form:string;accn:string;tag?:string;unit?:string};
export function secResearch(data:any,now=Date.now()){
 const gaap=data?.facts?.['us-gaap'];
 const facts=gaap??data?.facts?.['ifrs-full']??{};
 const aliases:Record<string,string>={Revenues:'Revenue',NetCashProvidedByUsedInOperatingActivities:'CashFlowsFromUsedInOperatingActivities',OperatingIncomeLoss:'ProfitLossFromOperatingActivities',NetIncomeLoss:'ProfitLoss',AssetsCurrent:'CurrentAssets',LiabilitiesCurrent:'CurrentLiabilities',PaymentsToAcquirePropertyPlantAndEquipment:'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',PaymentsOfDividends:'DividendsPaidClassifiedAsFinancingActivities'};
 const revenueUnits=Object.keys((facts.RevenueFromContractWithCustomerExcludingAssessedTax??facts.Revenues??facts.Revenue??facts.SalesRevenueNet)?.units??{}).filter(x=>/^[A-Z]{3}$/.test(x));
 // Ratios stay within a single reporting currency, independent of listing currency.
 const reportingCurrency=revenueUnits.length===1?revenueUnits[0]:'USD';
 const series=(tags:string[],unit=reportingCurrency,instant=false):Fact[]=>{
  const byEnd=new Map<string,Fact>();
  for(const tag of tags)for(const f of facts[gaap?tag:(aliases[tag]??tag)]?.units?.[unit]??[]){
   const duration=(Date.parse(f.end)-Date.parse(f.start))/86400000;
   if(!['10-K','10-K/A','20-F','20-F/A','40-F','40-F/A'].includes(f.form)||!Number.isFinite(f.val)||!Number.isFinite(Date.parse(f.filed))||Date.parse(f.filed)>now||Date.parse(f.end)>now)continue;
   if(instant?!!f.start:!(duration>=330&&duration<=380))continue;
   const old=byEnd.get(f.end);if(!old||f.filed>old.filed)byEnd.set(f.end,{...f,tag:gaap?tag:(aliases[tag]??tag),unit});
  }
  return [...byEnd.values()].sort((a,b)=>b.end.localeCompare(a.end));
 };
 const revenue=series(['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet']);
 const cfo=series(['NetCashProvidedByUsedInOperatingActivities']);
 const end=revenue[0]?.end??cfo[0]?.end;
 const raw:Record<string,number|null>={},provenance:Record<string,{source:string;asOf:string;filed:string;url:string;unit:string;inputs:unknown}>={};
 if(!end||now-Date.parse(end)>450*86400000)return {raw,provenance,asOf:end??null};
 const at=(rows:Fact[],date=end)=>rows.find(x=>x.end===date);
 const value=(f?:Fact)=>f?.val??null;
 const div=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
 const put=(key:string,v:number|null,inputs:(Fact|undefined)[])=>{
  if(v===null||!Number.isFinite(v)||inputs.some(f=>!f))return;
  raw[key]=v;const filed=inputs.map(f=>f!.filed).sort().at(-1)!;
  provenance[key]={source:'SEC EDGAR',asOf:end,filed,unit:'ratio',inputs:inputs.map(f=>({tag:f!.tag,value:f!.val,unit:f!.unit,start:f!.start??null,end:f!.end,filed:f!.filed,accession:f!.accn})),url:`https://www.sec.gov/edgar/browse/?CIK=${data.cik}`};
 };
 const op=series(['OperatingIncomeLoss']),net=series(['NetIncomeLoss']),assets=series(['Assets'],reportingCurrency,true);
 const current=series(['AssetsCurrent'],reportingCurrency,true),liabilities=series(['LiabilitiesCurrent'],reportingCurrency,true);
 const interest=series(['InterestExpenseNonOperating','InterestExpense']);
 const shares=series(['WeightedAverageNumberOfDilutedSharesOutstanding'],'shares');
 const capex=series(['PaymentsToAcquirePropertyPlantAndEquipment']);
 const dividends=series(['PaymentsOfDividendsCommonStock','PaymentsOfDividends']);
 const buybacks=series(['PaymentsForRepurchaseOfCommonStock']);
 const rev=at(revenue),oper=at(op),cf=at(cfo),ni=at(net),asset=at(assets);
 const previous=revenue.find(x=>Date.parse(end)-Date.parse(x.end)>330*86400000&&Date.parse(end)-Date.parse(x.end)<400*86400000);
 put('operatingMargin',div(value(oper),value(rev)),[oper,rev]);
 // Use average beginning/end assets, never a quarterly balance against an unrelated duration.
 const beginning=assets.find(x=>cf?.start&&Math.abs(Date.parse(x.end)-Date.parse(cf.start)+86400000)<=7*86400000);
 const avgAssets=asset&&beginning?(asset.val+beginning.val)/2:null;
 put('cfoAssets',div(value(cf),avgAssets),[cf,asset,beginning]);
 put('accruals',div(ni&&cf?ni.val-cf.val:null,avgAssets),[ni,cf,asset,beginning]);
 put('debtCoverage',div(value(at(current)),value(at(liabilities))),[at(current),at(liabilities)]);
 put('interestCoverage',div(value(oper),value(at(interest))),[oper,at(interest)]);
 if(previous){
  put('revenueGrowth',rev&&previous.val>0?rev.val/previous.val-1:null,[rev,previous]);
  const oldOp=at(op,previous.end),oldShares=at(shares,previous.end),newShares=at(shares);
  put('marginChange',oper&&rev&&rev.val>0&&oldOp&&previous.val>0?oper.val/rev.val-oldOp.val/previous.val:null,[oper,rev,oldOp,previous]);
  put('dilution',newShares&&oldShares&&oldShares.val>0?newShares.val/oldShares.val-1:null,[newShares,oldShares]);
  put('perShareProfitGrowth',oper&&oldOp&&newShares&&oldShares&&oldOp.val>0&&newShares.val>0&&oldShares.val>0?(oper.val/newShares.val)/(oldOp.val/oldShares.val)-1:null,[oper,oldOp,newShares,oldShares]);
 }
 const contiguous=(xs:Fact[],count:number)=>xs.length>=count&&xs.slice(0,count-1).every((x,i)=>{const d=(Date.parse(x.end)-Date.parse(xs[i+1].end))/86400000;return d>=330&&d<=400;});
 if(contiguous(revenue,4)&&revenue.slice(0,4).every(x=>x.val>0)){
  put('revenueCagr',Math.pow(revenue[0].val/revenue[3].val,1/3)-1,revenue.slice(0,4));
  put('growthContinuity',revenue.slice(0,3).filter((x,i)=>x.val>revenue[i+1].val).length/3,revenue.slice(0,4));
 }
 if(cfo[0]?.end===end&&contiguous(cfo,3))put('cashflowHealth',cfo.slice(0,3).filter(x=>x.val>0).length/3,cfo.slice(0,3));
 const cap=at(capex),dv=at(dividends),bb=at(buybacks);
 put('payoutCoverage',cf&&cap&&dv&&bb?div(cf.val-cap.val,dv.val+bb.val):null,[cf,cap,dv,bb]);
 return {raw,provenance,asOf:end};
}
