import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/firebase';
export async function uploadProductImage(file,productId){if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>8*1024*1024)throw new Error('Image must be smaller than 8 MB.');const path=`products/${productId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const r=ref(storage,path);await uploadBytes(r,file,{contentType:file.type});return {url:await getDownloadURL(r),path};}
export const deleteProductImage=path=>deleteObject(ref(storage,path));
