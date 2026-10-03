import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { createGuideAction } from "../actions";
import { GuideForm } from "../guide-form";

export const metadata: Metadata = { title: "New guide" };

export default function NewGuidePage() {
  return (
    <>
      <PageTitle kicker="guides">New page</PageTitle>
      <Card>
        <GuideForm action={createGuideAction} submitText="Create page" />
      </Card>
    </>
  );
}
