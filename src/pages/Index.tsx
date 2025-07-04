
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus, FileCheck } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Se l'utente è autenticato, reindirizza alla dashboard
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  // Mostra un loading mentre verifica l'autenticazione
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Se non è autenticato, mostra la pagina di benvenuto con opzioni di login
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-4">Credibility Assessment Platform</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Piattaforma AI per la valutazione della credibilità dei piani di transizione
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/login">
            <Button className="flex items-center gap-2" size="lg">
              <LogIn className="h-4 w-4" />
              Accedi
            </Button>
          </Link>
          
          <Link to="/signup">
            <Button variant="outline" className="flex items-center gap-2" size="lg">
              <UserPlus className="h-4 w-4" />
              Registrati
            </Button>
          </Link>
        </div>
        
        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Come iniziare:</h3>
          <p className="text-sm text-muted-foreground">
            Accedi o crea un account per caricare i tuoi documenti di piano di transizione e ricevere valutazioni di credibilità basate su AI.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
