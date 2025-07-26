import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-card-elevated text-center">
        <CardHeader>
          <div className="mx-auto text-6xl font-bold text-muted-foreground mb-4">
            404
          </div>
          <CardTitle className="text-xl font-semibold">
            Page Not Found
          </CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full button-primary-enhanced">
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full button-enhanced">
            <Link to="javascript:history.back()">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
