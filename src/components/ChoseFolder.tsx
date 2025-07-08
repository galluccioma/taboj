import React from "react";

interface ChooseFolderProps {
  folderPath: string;
  handleChooseFolder: () => void;
}

function ChooseFolder({ folderPath, handleChooseFolder }: ChooseFolderProps) {
    return(
        <div className="flex mb-2 hidden">
            <input
              type="text"
              className="input flex-1 px-3 py-2 border rounded mr-2 text-black"
              placeholder="Scegli la cartella di destinazione"
              value={folderPath}
              readOnly
            />
            <button
              className="btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400"
              type="button"
              onClick={handleChooseFolder}
            >
              Scegli Cartella
            </button>
          </div>
    )
}

export default ChooseFolder;