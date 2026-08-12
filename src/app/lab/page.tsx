import type { Metadata } from "next";
import { ValidationLab } from "@/components/ValidationLab";

export const metadata: Metadata = {
  title: "TRI6 Validation Lab",
  description: "Walk-forward validation console for TRI6 geometric compression signals.",
};

export default function ValidationLabPage() {
  return <ValidationLab />;
}
