import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bzwmhtgctdvvesjrdsxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6d21odGdjdGR2dmVzanJkc3h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzQ3NDcsImV4cCI6MjA4MDM1MDc0N30.rWU6GYik7nyQbJpygZsnWELwQ3eSmGirb5BfO6EFyZE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'e2e-test@chatapp.dev',
        password: 'TestPassword123!'
    });
    if (authError) {
        console.error("Auth error:", authError);
        return;
    }

    const session = authData.session;
    console.log("Logged in as", session.user.id);

    const { data, error } = await supabase
        .from('rooms')
        .insert([{ name: 'DM: test script', type: 'dm', created_by: session.user.id }])
        .select()
        .single();

    console.log("Result data:", data);
    console.log("Result error:", error);
}

run();
