import React from 'react';
import { Database, AlertCircle } from 'lucide-react';

const SupabaseSetupMessage: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full shadow-2xl border border-gray-700">
        <div className="flex items-center mb-4 text-yellow-400">
          <AlertCircle className="mr-2" size={24} />
          <h2 className="text-xl font-bold">Supabase Setup Required</h2>
        </div>

        <p className="mb-4 text-gray-300">
          This app requires a Supabase project to work. Please follow these steps to set up your database:
        </p>

        <div className="bg-gray-900 rounded-lg p-4 mb-4 text-gray-300">
          <h3 className="font-bold mb-2 text-white flex items-center">
            <Database className="mr-2" size={16} />
            Supabase Setup Instructions
          </h3>
          
          <ol className="list-decimal pl-5 space-y-2">
            <li>Create a new Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">supabase.com</a></li>
            <li>Create a new table called <code className="bg-gray-800 px-1 py-0.5 rounded">players</code> with the following columns:
              <ul className="list-disc pl-5 mt-1 text-sm">
                <li><code className="bg-gray-800 px-1 py-0.5 rounded">id</code> (text, primary key)</li>
                <li><code className="bg-gray-800 px-1 py-0.5 rounded">name</code> (text)</li>
                <li><code className="bg-gray-800 px-1 py-0.5 rounded">x</code> (integer)</li>
                <li><code className="bg-gray-800 px-1 py-0.5 rounded">y</code> (integer)</li>
                <li><code className="bg-gray-800 px-1 py-0.5 rounded">color</code> (text)</li>
              </ul>
            </li>
            <li>Enable realtime for the <code className="bg-gray-800 px-1 py-0.5 rounded">players</code> table:
              <ul className="list-disc pl-5 mt-1 text-sm">
                <li>Go to Database → Replication</li>
                <li>Enable realtime for the <code className="bg-gray-800 px-1 py-0.5 rounded">players</code> table</li>
              </ul>
            </li>
            <li>Copy your Supabase URL and anon key from Project Settings → API</li>
            <li>Update the <code className="bg-gray-800 px-1 py-0.5 rounded">src/lib/supabase.ts</code> file with your credentials</li>
          </ol>
        </div>

        <p className="text-white">
          Once you've completed these steps, refresh the page to start playing!
        </p>
      </div>
    </div>
  );
};

export default SupabaseSetupMessage;