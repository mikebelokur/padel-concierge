import { useState } from "react";
import { useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Register() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", password: "",
    level: "D", goal: "Play", intensity: "Competitive",
    locationName: ""
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: () => setLocation("/login")
    }
  });

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);
  const handleSubmit = () => {
    registerMutation.mutate({ data: formData });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-serif">Join Padel Concierge</CardTitle>
          <div className="text-sm text-muted-foreground">Step {step} of 3</div>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-background border-white/10" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" className="bg-background border-white/10" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} type="password" className="bg-background border-white/10" />
              </div>
              <Button className="w-full" onClick={handleNext}>Next</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <select 
                  className="w-full p-2 bg-background border border-white/10 rounded-md"
                  value={formData.level} 
                  onChange={e => setFormData({...formData, level: e.target.value})}
                >
                  <option value="D-">D-</option>
                  <option value="D">D</option>
                  <option value="D+">D+</option>
                  <option value="C-">C-</option>
                  <option value="C">C</option>
                  <option value="C+">C+</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handlePrev} className="w-full border-white/10">Back</Button>
                <Button className="w-full" onClick={handleNext}>Next</Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.locationName} onChange={e => setFormData({...formData, locationName: e.target.value})} className="bg-background border-white/10" placeholder="Dubai Marina" />
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={handlePrev} className="w-full border-white/10">Back</Button>
                <Button className="w-full" onClick={handleSubmit} disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? "Creating..." : "Complete"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
