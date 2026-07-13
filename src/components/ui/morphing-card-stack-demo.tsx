import { Component } from "@/components/ui/morphing-card-stack";
import { Upload, CheckCircle2, LayoutDashboard, FileClock, FileText } from "lucide-react";

const cardData = [
  {
    id: "1",
    title: "Upload Data",
    description: "Import the quarterly stock count Excel workbook to begin reconciliation",
    icon: <Upload className="h-5 w-5" />,
  },
  {
    id: "2",
    title: "Validate Data",
    description: "Review unmapped divisions, suppliers and org codes before committing",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    id: "3",
    title: "Dashboard",
    description: "Explore reconciliation metrics across divisions, suppliers and locations",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    id: "4",
    title: "Pre-report",
    description: "Preview the audit findings and flag items needing sign-off",
    icon: <FileClock className="h-5 w-5" />,
  },
  {
    id: "5",
    title: "Report",
    description: "Generate the final audited PDF report ready for the client",
    icon: <FileText className="h-5 w-5" />,
  },
]
export default function DemoOne() {
  return <Component cards={cardData} />;
}
