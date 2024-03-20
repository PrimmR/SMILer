# SMILer

This is a tool to convert SVG SMIL animations into rasterised PNG frames. I made it after making some animated SVGs and then finding out that I had no way to export them into a form that I could easily use.

## Usage

You can access an instance of the tool online [here at my website](https://tools.primm.gay/smiler). Or, if you prefer, you can clone this repository yourself and host it locally.

Then open up `index.html` in a browser, select the file, set your parameters, then press convert. The SVG should be processed and a ZIP file containing a PNG for each requested frame should be downloaded soon after.

If you're having issues, please check the console log. If the error states that your XML is not well-formed, you may need to re-export your file formatted as a more compatible SVG, if possible.