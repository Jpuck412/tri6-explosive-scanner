import Link from "next/link";
import { ScannerDashboard } from "@/components/ScannerDashboard";
import styles from "./home.module.css";

export default function Home() {
  return (
    <>
      <ScannerDashboard />
      <Link className={styles.labLink} href="/lab"><b>◆</b> VALIDATION LAB</Link>
    </>
  );
}
