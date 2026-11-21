import React from 'react';import{createRoot}from'react-dom/client';import App from './App';import './styles/main.css';import 'react-hot-toast';
const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;document.head.appendChild(script);
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
