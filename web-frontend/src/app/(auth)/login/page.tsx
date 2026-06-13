import { LoginForm } from "@/forms/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden flex justify-center items-center">
      <div className="p-12 flex flex-col items-center bg-white rounded-md shadow-md ">
        <div className="flex space-x-2 ">
          <p className="text-2xl font-bold text-[#346EF6] ">JAMJADE CAR RENTAL</p>
        </div>
        <p className="text-sm mb-6">Enter your credentials to continue </p>
        <LoginForm/>
      </div>
    </div>
  );
}
