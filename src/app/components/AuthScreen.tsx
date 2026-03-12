import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { useAuthStore } from "../../stores/authStore";
import { toast } from "sonner";

export function AuthScreen() {
  const navigate = useNavigate();
  const { login, signup, loading } = useAuthStore();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginEmail, loginPassword);
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(signupData.email, signupData.password, {
        first_name: signupData.firstName,
        last_name: signupData.lastName,
        phone: signupData.phone,
      });
      toast.success('Account created! Check your email to confirm.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-amber-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🐄</div>
          <CardTitle className="text-2xl">ZimLivestock</CardTitle>
          <CardDescription>Your livestock marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="email@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      type="text"
                      placeholder="John"
                      value={signupData.firstName}
                      onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      placeholder="Doe"
                      value={signupData.lastName}
                      onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="0771234567"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                    required
                    pattern="0[17][0-9]{8}"
                    title="Enter a valid Zimbabwe phone number (e.g. 0771234567)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="email@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p className="w-full">
            By continuing, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms</a>
            {' & '}
            <a href="#" className="text-primary hover:underline">Privacy</a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
