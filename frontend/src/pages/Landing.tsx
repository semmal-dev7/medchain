import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, FileKey, KeyRound, Siren } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Patient-Controlled Data",
    description: "Patients own and control who accesses their medical records via blockchain-based permissions.",
  },
  {
    icon: Database,
    title: "Encrypted IPFS Storage",
    description: "Medical files are encrypted and stored on IPFS, ensuring tamper-proof and decentralized data availability.",
  },
  {
    icon: FileKey,
    title: "Smart Contract Access",
    description: "Solidity smart contracts on Polygon enforce granular, transparent access control without intermediaries.",
  },
  {
    icon: KeyRound,
    title: "Zero-Knowledge Proofs",
    description: "Sensitive patient information is verified without exposing the actual medical data, providing privacy-preserving access control.",
  },
  {
    icon: Siren,
    title: "Break-Glass Emergency Access",
    description: "Emergency access to essential patient data is granted through temporary permissions, with every action recorded for accountability.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">MedChain</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate("/register")}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your Health Data. Your Control.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Protect sensitive medical records with encryption, blockchain access management, and zero-knowledge privacy.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button size="lg" onClick={() => navigate("/login")}>
            Patient Portal
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/hospital/login")}>
            Hospital Portal
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/doctor/login")}>
            Doctor Portal
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {features.map((f) => (
            <Card key={f.title} className="border-border/60 shadow-md transition-shadow hover:shadow-lg">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
