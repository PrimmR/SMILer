const nsResolver = prefix => {
    var ns = {
        'svg': 'http://www.w3.org/2000/svg',
        'xlink': 'http://www.w3.org/1999/xlink'
    };
    return ns[prefix] || null;
};

const blobify = e => new Blob([e], { type: 'image/svg+xml' });

const takeSnap = (svg, ctx, canvas) => {
    // Get all animateTransform elements and store animVal.matrix in a dataset attribute
    let animateXPath = document.evaluate('//svg:*[svg:animateTransform]', svg, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        let mStr = [...node.transform.animVal].map(animVal => {
            let m = animVal.matrix;
            return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
        }).join(' ');
        node.dataset.transform = mStr;
    });

    // Get all animate elements and store all properties in a dataset attribute on the target for the animation
    animateXPath = document.evaluate('//svg:animate', svg, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        let propName = node.getAttribute('attributeName');
        let target = node.targetElement;
        let computedVal = getComputedStyle(target)[propName];
        target.dataset[propName] = computedVal;
    });

    // Create a copy of the SVG DOM
    let parser = new DOMParser();
    let svgcopy = parser.parseFromString(svg.outerHTML, "application/xml");

    // Find all elements with a dataset attribute
    animateXPath = svgcopy.evaluate('//svg:*[@*[starts-with(name(), "data")]]', svgcopy, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    // Copy the animated property to a style or attribute on the same element
    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        // for each data-
        for (key in node.dataset) {
            if (key == 'transform') {
                node.setAttribute(key, node.dataset[key]);
            } else {
                node.style[key] = node.dataset[key];

            }
        }
    });

    // Find and remove all animate and animateTransform elements from the copy document
    animateXPath = svgcopy.evaluate('//svg:*[starts-with(name(), "animate")]', svgcopy, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        node.remove();
    });

    // Create url of image to copy to the canvas
    let blob = blobify(svgcopy.documentElement.outerHTML);
    let url = URL.createObjectURL(blob);

    const tempImg = new Image();

    let promise = new Promise(resolve => {
        tempImg.addEventListener('load', () => {
            // Update canvas with new image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);

            // Export base blob png image based on canvas
            resolve(canvas.convertToBlob())
        });
    });
    tempImg.src = url;

    return promise;
};

document.getElementById("btn").addEventListener('click', () => {
    const filename = document.getElementById("filechoose").files.item(0).name;
    const fileprefix = filename.substring(0, filename.lastIndexOf('.')) || filename;

    // Get values for framerate and duration
    const fps = parseFloat(document.getElementById('fps').value);
    const duration = parseFloat(document.getElementById('dur').value);
    const frames = fps * duration;

    // Constant elements
    const svg = svgcontainer.querySelector('svg');
    const zip = new JSZip();


    // Set up canvas
    const svgaspectratio = svg.width.animVal.value / svg.height.animVal.value;
    const quality = document.getElementById("quality").value
    const canvas = new OffscreenCanvas(quality, quality / svgaspectratio)

    const ctx = canvas.getContext('2d');

    // Set up a resolved promise for our loop
    let step = Promise.resolve();

    // Take snapshots at requested frames
    for (let i = 0; i < frames; i++) {
        step = step.then(() => {
            svg.unpauseAnimations();
            svg.setCurrentTime(i / fps);
            svg.pauseAnimations();

            return takeSnap(svg, ctx, canvas).then(b64 => zip.file(`${i}.png`, b64));
        });
    }

    // When complete, download zip
    step.then(() => zip.generateAsync({ type: "blob" }).then(blob => {
        saveAs(blob, `${fileprefix}-frames.zip`);

        svg.unpauseAnimations();
    }));

});

// Setup when file chosen
// Read the file from specified path and display to user
document.getElementById("filechoose").addEventListener('change', e => {
    // Get selected file
    const file = e.target.files.item(0);
    const svgcontainer = document.getElementById('svgcontainer');

    file.text().then(text => {
        // Copy contents of SVG into document
        let parser = new DOMParser();
        let svgdoc = parser.parseFromString(text, "application/xml");

        // Properly size SVG
        svgdoc.documentElement.setAttribute("width", "100%");
        svgdoc.documentElement.setAttribute("height", "100%");

        svgcontainer.innerHTML = svgdoc.documentElement.outerHTML;
    })

    // Show convert button and update file label with file name 
    document.getElementById('btn').style.display = "block";
    document.getElementById('filelabel').textContent = file.name;
});