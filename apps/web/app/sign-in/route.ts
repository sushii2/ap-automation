import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"

// Also the "Initiate login URI" configured in the WorkOS dashboard.
export async function GET() {
  redirect(await getSignInUrl())
}
