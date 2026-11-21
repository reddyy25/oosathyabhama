import {createContext,useContext,useEffect,useMemo,useState} from 'react';
const C=createContext(null); const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};
export function ShopProvider({children}){const [cart,setCart]=useState(read('oosa-cart'));const [wishlist,setWishlist]=useState(read('oosa-wishlist'));useEffect(()=>localStorage.setItem('oosa-cart',JSON.stringify(cart)),[cart]);useEffect(()=>localStorage.setItem('oosa-wishlist',JSON.stringify(wishlist)),[wishlist]);
 const add=(p,size,color)=>setCart(old=>{const key=`${p.id}-${size}-${color}`;const found=old.find(x=>x.key===key);return found?old.map(x=>x.key===key?{...x,qty:Math.min(x.qty+1,Number(p.stock||99))}:x):[...old,{key,id:p.id,name:p.name,price:Number(p.price),image:p.images?.[0]?.url||p.images?.[0]||'',size,color,qty:1,stock:Number(p.stock||0)}]});
 const qty=(key,n)=>setCart(old=>old.map(x=>x.key===key?{...x,qty:Math.max(1,Math.min(Number(n)||1,x.stock||1))}:x));const remove=key=>setCart(old=>old.filter(x=>x.key!==key));const toggle=id=>setWishlist(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);const clear=()=>setCart([]);
 const value=useMemo(()=>({cart,wishlist,add,qty,remove,toggle,clear,subtotal:cart.reduce((s,x)=>s+x.price*x.qty,0)}),[cart,wishlist]);return <C.Provider value={value}>{children}</C.Provider>}
export const useShop=()=>useContext(C);
