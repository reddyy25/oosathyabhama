export const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0);
export const discount=(price,mrp)=>mrp>price?Math.round((1-price/mrp)*100):0;
