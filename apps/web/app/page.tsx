import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { Button } from "@workspace/ui/components/ui/cubby-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/cubby-ui/card";

export default async function Page() {
  const { user } = await withAuth();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>AP Automation</CardTitle>
          <CardDescription>
            Sign in to manage invoices and payments.
          </CardDescription>
        </CardHeader>
        {/* Plain anchors: these routes set a PKCE cookie and must not be prefetched. */}
        <CardContent className="flex flex-col gap-3">
          <Button nativeButton={false} render={<a href="/sign-in" />}>
            Sign in
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/sign-up" />}
          >
            Create an account
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
