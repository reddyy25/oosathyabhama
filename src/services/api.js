const base=(import.meta.env.VITE_PAYMENT_API_URL||'/api').replace(/\/$/,'');
export async function api(path,body){const res=await fetch(`${base}/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Request failed. Please try again.');return data;}
