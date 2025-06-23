
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold mb-4">Credibility Assessment Platform</h1>
        <p className="text-xl text-muted-foreground mb-8">
          AI-powered transition plan credibility assessment tool
        </p>
        
        <div className="flex justify-center">
          <Link to="/admin/upload-questionnaire">
            <Button className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Admin: Upload Questionnaire
            </Button>
          </Link>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          Upload the credibility questionnaire JSON file to get started
        </p>
      </div>
    </div>
  );
};

export default Index;
