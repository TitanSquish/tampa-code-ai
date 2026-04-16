import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-1">
          <h1 className="text-[28px] font-semibold leading-[1.15] text-foreground">
            Tampa Code AI
          </h1>
          <p className="text-[13px] font-medium leading-[1.4] text-muted-foreground">
            Tampa building permit code assistant
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full"
            />
          </div>
          <Button className="w-full" disabled>
            Continue with Email
          </Button>
          <p className="text-[13px] font-medium leading-[1.4] text-muted-foreground text-center">
            You'll receive a sign-in code by email.
          </p>
        </div>
      </div>
    </div>
  )
}
