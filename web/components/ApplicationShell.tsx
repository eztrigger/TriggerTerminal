"use client";
import TopBar from './TopBar';
export default function ApplicationShell({children}:{children:React.ReactNode}){
 return <div className="application-shell"><TopBar/><div className="application-content">{children}</div></div>;
}
