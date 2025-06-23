
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Upload, LogIn, FileCheck } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-4">Credibility Assessment Platform</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-powered transition plan credibility assessment tool
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/auth">
            <Button className="flex items-center gap-2" size="lg">
              <LogIn className="h-4 w-4" />
              Sign In / Sign Up
            </Button>
          </Link>
          
          <Link to="/dashboard">
            <Button variant="outline" className="flex items-center gap-2" size="lg">
              <FileCheck className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
          
          <Link to="/admin/upload-questionnaire">
            <Button variant="secondary" className="flex items-center gap-2" size="lg">
              <Upload className="h-4 w-4" />
              Admin Panel
            </Button>
          </Link>
        </div>
        
        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Get Started:</h3>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to upload your transition plan documents and receive AI-powered credibility assessments.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
