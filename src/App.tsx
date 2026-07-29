import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./components/ui/button";
import { useNavigate } from "react-router";

export default function AuthenticatedRoute() {
  const navigate = useNavigate();
  const supabase = createClient();

  const signOut = () => {
    supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { error } = await supabase.auth.getUser();

      if (error) {
        location.href = "/login";
      }
    };
    checkAuth();
  }, []);

  const test = async () => {
    const {} = await supabase.from("accounts").insert([{ name: "test" }]);
  };

  return (
    <div>
      Authenticated page
      <Button onClick={test}>Test</Button>
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
