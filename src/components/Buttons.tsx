import React from 'react';

interface ButtonsProps {
  handleStartScraping: () => void;
  handleStopScraping: () => void;
}

function Buttons({ handleStartScraping, handleStopScraping }: ButtonsProps) {
  return (
    <div className="flex mb-4 space-x-2 mt-10">
      <button
        className="btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        onClick={handleStartScraping}
      >
        Scarica i dati ora 📑
      </button>
      <button
        className="btn btn-stop px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        onClick={handleStopScraping}
      >
        Stop
      </button>
    </div>
  );
}

export default Buttons;
