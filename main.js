const nsResolver = prefix => {
    var ns = {
        'svg': 'http://www.w3.org/2000/svg',
        'xlink': 'http://www.w3.org/1999/xlink'
    };
    return ns[prefix] || null;
};

const blobify = e => new Blob([e], { type: 'image/svg+xml' });

const addToZip = (zip, b64, name) => {
    // Convert data URI to plain base64
    let imgDataIndex = b64.indexOf("base64,") + "base64,".length;
    let imgData = b64.substr(imgDataIndex);
    zip.file(`${name}.png`, imgData, { base64: true });
}

const takeSnap = (svg, ctx) => {
    // get all animateTransform elements
    let animateXPath = document.evaluate('//svg:*[svg:animateTransform]', svg, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    // store all animateTransform animVal.matrix in a dataset attribute
    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        let mStr = [...node.transform.animVal].map(animVal => {
            let m = animVal.matrix;
            return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
        }).join(' ');
        node.dataset.transform = mStr;
    });

    // get all animate elements
    animateXPath = document.evaluate('//svg:animate', svg, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    // store all animate properties in a dataset attribute on the target for the animation
    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        let propName = node.getAttribute('attributeName');
        let target = node.targetElement;
        let computedVal = getComputedStyle(target)[propName];
        target.dataset[propName] = computedVal;
    });

    // create a copy of the SVG DOM
    let parser = new DOMParser();
    let svgcopy = parser.parseFromString(svg.outerHTML, "application/xml");

    // find all elements with a dataset attribute
    animateXPath = svgcopy.evaluate('//svg:*[@*[starts-with(name(), "data")]]', svgcopy, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    // copy the animated property to a style or attribute on the same element
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

    // find all animate and animateTransform elements from the copy document
    animateXPath = svgcopy.evaluate('//svg:*[starts-with(name(), "animate")]', svgcopy, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    // remove all animate and animateTransform elements from the copy document
    Object.keys([...Array(animateXPath.snapshotLength)]).forEach(i => {
        let node = animateXPath.snapshotItem(i);
        node.remove();
    });

    // Create url of image to copy to the canvas
    let blob = blobify(svgcopy.documentElement.outerHTML);
    let url = URL.createObjectURL(blob);

    // Promise of a base 64 string to return


    const tempImg = new Image();

    let promise = new Promise(resolve => {
        tempImg.addEventListener('load', () => {
            // update canvas with new image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);

            // create PNG image based on canvas
            // let img = new Image();
            // img.src = canvas.toDataURL("image/png", 50.0);
            // document.getElementById('output').append(img);

            // Export base 64 png image based on canvas
            resolve(canvas.toDataURL("image/png", 50.0))
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

    // Set up canvas
    const canvas = document.getElementById('canvas');
    canvas.width = 400;
    canvas.height = 400;

    // Constant elements
    const ctx = canvas.getContext('2d');
    const svg = svgcontainer.querySelector('svg');
    const zip = new JSZip();

    // Set up a resolved promise for our loop
    let step = Promise.resolve();

    // Take snapshots at requested frames
    for (let i = 0; i < frames; i++) {
        step = step.then(() => {
            svg.unpauseAnimations();
            svg.setCurrentTime(i / fps);
            svg.pauseAnimations();

            return takeSnap(svg, ctx).then(b64 => addToZip(zip, b64, i));
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
        svgcontainer.innerHTML = svgdoc.documentElement.outerHTML;
    })
});