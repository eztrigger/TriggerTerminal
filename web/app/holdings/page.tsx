"use client";
import {tr,uiLocale} from "../../lib/i18n";
import Holdings from '../../components/widgets/ManualPortfolioWidget';
export default function Page(){return <main className="holdings-page holdings-home"><div className="holdings-page-inner"><header className="holdings-home-header"><h1>{tr("仓位与持仓")}</h1></header><Holdings/></div></main>;}
