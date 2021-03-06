$(function () {
    setInterfaceCoordinates();
    setupBtns();
    display();
});

function setInterfaceCoordinates() {
    var scrollPos = $(document).scrollTop();
    baseOffsetY = baseOffsetY ? baseOffsetY : chart[0][0].getBoundingClientRect().top;
    var mainOffsetY = chart[0][0].getBoundingClientRect().top + scrollPos;
    extraOffsetY = mainOffsetY - baseOffsetY;
    if (itemsLayer)
        itemsLayer.style('top', itemSvgOffsetY + extraOffsetY);
    annotationsMainOffsetY = mainHeight + mainScale + spaceAfterMain;
    covMainOffsetY = drawCoverage ? (annotationsMainOffsetY +
                            (featuresHidden ? 0 : spaceAfterTrack)) : annotationsMainOffsetY;
    if (!featuresMainHidden)
        covMainOffsetY += annotationsHeight;
    miniOffsetY = covMainOffsetY + spaceAfterTrack;
    annotationsMiniOffsetY = miniOffsetY + miniHeight + (featuresHidden ? 0 : spaceAfterTrack);
    covMiniOffsetY = annotationsMiniOffsetY + annotationsMiniHeight + spaceAfterTrack;

    var physCovBtnOffsetY = 25;

    hideBtnAnnotationsMiniOffsetY = annotationsMiniOffsetY + mainOffsetY;
    hideBtnAnnotationsMainOffsetY = annotationsMainOffsetY + mainOffsetY;
    hideBtnCoverageMiniOffsetY = covMiniOffsetY + mainOffsetY;
    hideBtnCoverageMainOffsetY = covMainOffsetY + mainOffsetY;
    hideBtnPhysicalMiniCoverageOffsetY = hideBtnCoverageMiniOffsetY + physCovBtnOffsetY;
    hideBtnPhysicalCoverageOffsetY = hideBtnCoverageMainOffsetY + physCovBtnOffsetY;
}

function setupBtns() {
    if (!featuresHidden) addAnnotationsTrackButtons();
    if (drawCoverage) {
        addCovTrackButtons();
        if (typeof physical_coverage_data !== 'undefined')
            addPhysicalCovTrackButtons();
        addCoverageButtons();
    }
}

function setupInterface() {
    document.getElementById('left').onclick=function() {
        keyPress('left', 1) };
    document.getElementById('left_shift').onclick=function() {
        keyPress('left', 5) };
    document.getElementById('right').onclick=function() {
        keyPress('right', 1) };
    document.getElementById('right_shift').onclick=function() {
        keyPress('right', 5) };
    document.getElementById('zoom_in').onclick=function() {
        keyPress('zoom_in', 25) };
    document.getElementById('zoom_in_5').onclick=function() {
        keyPress('zoom_in', 40) };
    document.getElementById('zoom_out').onclick=function() {
        keyPress('zoom_out', 50) };
    document.getElementById('zoom_out_5').onclick=function() {
        keyPress('zoom_out', 200) };

    document.getElementById('input_coords_start').onkeydown=function(event) {
        enterCoords(event, this, 0);
    };
    document.getElementById('input_coords_end').onkeydown=function(event) {
        enterCoords(event, this, 1);
    };
    if (document.getElementById('input_contig_threshold')) {
        document.getElementById('input_contig_threshold').value = minContigSize;
        document.getElementById('input_contig_threshold').onkeyup = function(event) {
            setContigSizeThreshold(event, this) };
    }

    setupAutocompleteSearch();

    setupChromosomeSelector(document.getElementById('select_chr_start'), 0);
    setupChromosomeSelector(document.getElementById('select_chr_end'), 1);

    var checkboxes = document.getElementsByName('misassemblies_select');
    for(var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].addEventListener('change', function(){
            showMisassemblies();
        });
    }
    window.onresize = function(){ location.reload(); };
    display();
}

function keyPress (cmd, deltaCoeff) {
    var ext = brush.extent();
    var delta = .01 * (ext[1] - ext[0]);
    if (deltaCoeff) delta *= deltaCoeff;
    delta = Math.max(1, delta);
    switch (cmd) {
        case 'zoom_in':
            if (ext[1] - ext[0] - 2 * delta > minBrushExtent)
                brush.extent([ext[0] + delta, ext[1] - delta]);
            break;
        case 'zoom_out':
            brush.extent([ext[0] - delta, ext[1] + delta]);
            break;
        case 'left':
            if (ext[0] > 0) brush.extent([ext[0] - delta, ext[1] - delta]);
            break;
        case 'right':
            if (ext[1] < x_mini.domain()[1]) brush.extent([ext[0] + delta, ext[1] + delta]);
            break;
        case 'esc': {
            info.selectAll('p')
                .remove();
            info.selectAll('span')
                .remove();
            addClickContigText(info);
            setBaseChartHeight();
            arrows = [];
            mini.selectAll('.arrow').remove();
            mini.selectAll('.arrow_selected').remove();
            removeTooltip();
            selected_id = null;
            break
        }
    }
    itemsContainer.select('.glow').remove();
    display();
}

function keyPressAnswer() {
    if (d3.event.target.className == 'textBox') return;
    var charCode = d3.event.which || d3.event.keyCode;
    var charStr = String.fromCharCode(charCode);
    if (d3.event.shiftKey) deltaCoeff = 5;
    else deltaCoeff = 1;
    var ext = brush.extent();
    if (charStr == '-' || charStr == '_') // -
        keyPress('zoom_out', deltaCoeff);
    else if (charStr == '+' || charStr == '=') // +
        keyPress('zoom_in', deltaCoeff);
}

function keyDownAnswer() {
    var key = d3.event.keyCode;
    if (d3.event.target.className == 'textBox') return;
    if (d3.event.shiftKey) deltaCoeff = 5;
    else deltaCoeff = 1;
    var ext = brush.extent();
    if (key == 39 && x_mini.domain()[1] - ext[0] > minBrushExtent) // >
        keyPress('right', deltaCoeff);
    else if (key == 37 && ext[1] > minBrushExtent) // <
        keyPress('left', deltaCoeff);
    else if (key == 27)
        keyPress('esc');
}

function getChromCoords(coord, coordIndex) {
    if (isContigSizePlot || chrContigs.length <= 1) {
        return coord;
    }
    else {
        var chrSelector = coordIndex == 0 ? document.getElementById('select_chr_start') : document.getElementById('select_chr_end');
        var prevLen = 0;
        for (var i = 0; i < chrContigs.length - 1; i++) {
            chrName = chrContigs[i];
            chrLen = chromosomes_len[chrName];
            if (coord < prevLen + chrLen) {
                break;
            }
            prevLen += chrLen;
        }
        chrSelector.value = i;
        coord -= prevLen;
        return coord;
    }
}

function trimChrNames(contigNames){
    //gi_77461965_ref_NC_007493.1__Rhodobacter_sphaeroides_2.4.1_chromosome_1__complete_sequence
    if (contigNames.length == 1)
        return contigNames;
    var ncbiPattern = /gi_.+__(.+__.+)/i;
    var trimmedNames = [];
    for (i = 0; i < contigNames.length; i++) {
        found = contigNames[i].match(ncbiPattern);
        if (found && found.length > 1)
            trimmedNames.push(found[1]);
        else trimmedNames.push(contigNames[i]);
    }
    var sortedNames = trimmedNames.concat().sort();
    var s1 = sortedNames[0], s2 = sortedNames[sortedNames.length - 1];
    var maxIndex = s1.length;
    var commonStrings = [];
    var chrIndexInName = s1.indexOf('chromosome');
    if (chrIndexInName > -1)
        maxIndex = chrIndexInName;
    for (i = 0; i < s1.length; i++) {
        var j = i;
        while(j < maxIndex && s1.charAt(j)=== s2.charAt(j))
            j++;
        commonStrings.push(s1.substring(i, j))
    }
    if (!commonStrings)
        return trimmedNames;
    var commonString = commonStrings.sort(function (a, b) { return b.length - a.length; })[0];
    if (commonString.length < 7)
        return trimmedNames;
    var shortNames = [];
    for (i = 0; i < trimmedNames.length; i++) {
        splittedName = trimmedNames[i].split(commonString);
        if (splittedName.length == 1)
            shortNames.push(splittedName[0]);
        else if ((splittedName[0] + splittedName[1]).length < 30)
            shortNames.push(splittedName[0] + '...' + splittedName[1]);
        else if (splittedName[1].length < 10)
            shortNames.push(splittedName[0] + '...');
        else
            shortNames.push('...' + splittedName[1]);
    }
    return shortNames;
}

function setupChromosomeSelector(chrSelector, selectorIndex) {
    if (!isContigSizePlot && shortRefNames.length > 1) {
        chrSelector.style.display = "";
        for (var i = 0; i < shortRefNames.length; i++) {
            var option = document.createElement('option');
            var chr = shortRefNames[i];
            if (chr.length > 35) {
                chr = chr.slice(0, 30) + '...'
            }
            option.text = chr;
            option.value = i;
            chrSelector.add(option);
        }
        chrSelector.onchange = function(event) {
            var coordsTextBox = selectorIndex == 0 ? document.getElementById('input_coords_start') : document.getElementById('input_coords_end');
            var coords = [];
            if (selectorIndex == 1) {
                var coordsBoxStart = document.getElementById('input_coords_start');
                coords.push(getCoords(coordsBoxStart, 0));
            }
            coords.push(getCoords(coordsTextBox, selectorIndex, event.target.value));
            setCoords(coords);
        };
    }
}

function setupAutocompleteSearch(){
    var maxResults = 10;
    var autocompleteItems = createAutocompleteListItems();

    $( "#live_search" ).autocomplete({
            minLength: 1,
            maxHeight: 200,
            deferRequestBy: 50,
            source: function(request, response) {
                var results = $.ui.autocomplete.filter(autocompleteItems, request.term);
                var additionalLabel = '';
                if (results.length == 0) additionalLabel = 'No result';
                else if (results.length > maxResults) {
                    additionalLabel = results.length - maxResults + ' more results';
                }
                results = results.slice(0, maxResults);
                if (additionalLabel) {
                    results.push({
                        desc: additionalLabel
                    });
                }
                response(results);
            },
            focus: function( event, ui ) {
                $( "#live_search" ).val( ui.item.label );
                return false;
            },
            select: function( event, ui ) {
                if (!ui.item.value)
                    return;
                $( "#live_search" ).val( ui.item.label );
                var itemType = ui.item.value.split(',')[0];
                var itemValue = ui.item.value.split(',')[1];

                if (itemType == 'contig') {
                    var selectedItem = items[itemValue];
                    selected_id = selectedItem.groupId;
                    showArrows(selectedItem);
                    changeInfo(selectedItem);
                }
                else if (itemType == 'gene') {
                    var selectedItem = featuresData.features[itemValue];
                }
                var minSize = 5000;
                var start = selectedItem.corr_start;
                var end = Math.max(selectedItem.corr_end, selectedItem.corr_start + minSize);
                setCoords([start, end], true);
                display();

                return false;
            }
        })
        .focus(function(){
            $(this).autocomplete('search');
        })
        .autocomplete( "instance" )._renderItem = function( ul, item ) {
        return $( "<li>" )
            .append(item.desc)
            .appendTo(ul);
    };
}

function createAutocompleteListItems() {
    var autocompleteItems = [];
    for (var i = 0; i < items.length; i++) {
        if (isContigSizePlot && !items[i].fullContig)
            continue;
        var position = [formatValue(items[i].start, mainTickValue), ndash, formatValue(items[i].end, mainTickValue), mainTickValue, ' '].join(' ');
        var description = '<span style="color:gray"> ' + items[i].assembly + ': </span>' + items[i].name;
        if (isContigSizePlot){
            var size = items[i].size;
            var tickValue = getTickValue(size);
            size = formatValue(size, tickValue);
            description +=  ' ' + size + ' ' + tickValue;
        }
        else {
            description +=  ' ' + position;
        }
        autocompleteItems.push({
            label: items[i].name,
            value: 'contig,' + i,
            desc: description
        })
    }
    if (featuresData) {
        for (var i = 0; i < featuresData.features.length; i++) {
            var feature = featuresData.features[i];
            var featureKind = feature.kind[0].toUpperCase() + feature.kind.slice(1);
            var name = (feature.name ? ' ' + feature.name : '') + (feature.id_ ? ' ID=' + feature.id_ : '');
            var label = featureKind + name + ' ' + chrContigs[feature.chr];
            var position = [formatValue(feature.start, mainTickValue), ndash, formatValue(feature.end, mainTickValue), mainTickValue, ' '].join(' ');
            var description = '<span style="color:gray">' + featureKind + ': </span>' + name + ' ' + chrContigs[feature.chr];
            autocompleteItems.push({
                label: label + ' ' + chrContigs[feature.chr],
                value: 'gene,' + i,
                desc: description
            })
        }
    }
    return autocompleteItems;
}

function addCovTrackButtons() {
    var hideBtnCoverageMini = document.getElementById('hideBtnCovMini');
    var hideBtnCoverageMain = document.getElementById('hideBtnCovMain');
    setTrackBtnPos(hideBtnCoverageMini, hideBtnCoverageMiniOffsetY, 'cov', 'mini', true);
    setTrackBtnPos(hideBtnCoverageMain, hideBtnCoverageMainOffsetY, 'cov', 'main', false);
}

function addPhysicalCovTrackButtons() {
    var hideBtnPhysicalCoverageMini = document.getElementById('hideBtnPhysCovMini');
    var hideBtnPhysicalCoverageMain = document.getElementById('hideBtnPhysCovMain');
    setTrackBtnPos(hideBtnPhysicalCoverageMini, hideBtnPhysicalMiniCoverageOffsetY);
    setTrackBtnPos(hideBtnPhysicalCoverageMain, hideBtnPhysicalCoverageOffsetY);
    hideBtnPhysicalCoverageMain.style.display = 'none';

    var showCovText = 'Show physical';
    var hideCovText = 'Hide physical';
    addPhysCovTooltip(hideBtnPhysicalCoverageMini);
    addPhysCovTooltip(hideBtnPhysicalCoverageMain);

    hideBtnPhysicalCoverageMini.onclick = function() {
        physicalMiniCoverageHidden = !physicalMiniCoverageHidden;
        hideBtnPhysicalCoverageMini.innerHTML = physicalMiniCoverageHidden ? showCovText : hideCovText;
        togglePhysCoverageMini();
    };
    hideBtnPhysicalCoverageMain.onclick = function() {
        physicalCoverageHidden = !physicalCoverageHidden;
        hideBtnPhysicalCoverageMain.innerHTML = physicalCoverageHidden ? showCovText : hideCovText;
        main_cov.select('.phys_covered').classed('invisible', physicalCoverageHidden);
        display();
    };
}

function addPhysCovTooltip(hideBtn) {
    var physCovDescription = 'Physical coverage is the coverage of the reference by the paired-end fragments,<br>' +
        'counting the reads and the gap between the paired-end reads as covered.';
    hideBtn.onmouseover = function() {
        addTooltip(null, physCovDescription, event);
    };
    hideBtn.onmouseout = function() {
        removeTooltip();
    };
}

function togglePhysCoverageMini() {
    mini_cov.select('.phys_covered').classed('invisible', physicalMiniCoverageHidden);
}

function addAnnotationsTrackButtons() {
    hideBtnAnnotationsMini = document.getElementById('hideBtnAnnoMini');
    hideBtnAnnotationsMain = document.getElementById('hideBtnAnnoMain');
    setTrackBtnPos(hideBtnAnnotationsMini, hideBtnAnnotationsMiniOffsetY, 'features', 'mini', true);
    setTrackBtnPos(hideBtnAnnotationsMain, hideBtnAnnotationsMainOffsetY + 6, 'features', 'main', !featuresMainHidden);
    if (!featuresMainHidden)
        hideBtnAnnotationsMain.innerHTML = "Hide";
}

function setTrackBtnPos(hideBtn, offsetY, track, pane, doHide) {
    var hideBtnExpandWidth = 130;
    hideBtn.style.display = "";
    hideBtn.style.left = (margin.left - hideBtnExpandWidth) + "px";
    hideBtn.style.top = offsetY + "px";
    if (track && pane)
        addTrackBtnEvent(hideBtn, track, pane, doHide)
}

function addTrackBtnEvent(hideBtn, track, pane, doHide) {
    hideBtn.onclick = function() {
        hideTrack(track, pane, doHide);
    };
}

function enterCoords(event, textBox, coordIndex) {
    var key = event.keyCode || this.event.keyCode;
    if (key == 27) {
        textBox.blur();
    }
    if (key == 13) {
        var coords = [];
        if (coordIndex == 1) {
            var coordsStartBox = document.getElementById('input_coords_start');
            coords.push(getCoords(coordsStartBox, 0));
        }
        coords.push(getCoords(textBox, coordIndex));
        setCoords(coords);
    }
}

function getCoords(textBox, coordIndex, selectedIndex) {
    var coord = textBox.value;
    if (!isContigSizePlot && chrContigs.length > 1) {
        var chrSelector = coordIndex == 0 ? document.getElementById('select_chr_start') : document.getElementById('select_chr_end');
        var selectedContig = selectedIndex ? parseInt(selectedIndex) : chrSelector.options[chrSelector.selectedIndex].value;
        var selectedName = chrContigs[selectedContig];
        var prevLen = 0;
        for (var i = 0; i < selectedContig; i++) {
            chrName = chrContigs[i];
            chrLen = chromosomes_len[chrName];
            prevLen += chrLen;
        }
        if (parseInt(coord)) {
            coord = Math.min(parseInt(coord) + prevLen, chromosomes_len[selectedName] + prevLen - 1);
        }
    }
    return coord;
}

var timerAnimationSetCoords;

function setCoords(coords, animation) {
    var ext = brush.extent();
    var startCoord = ext[0], endCoord = ext[1];
    if (coords.length >= 2 && parseInt(coords[0]) <= parseInt(coords[1])) {
        startCoord = parseInt(coords[0]);
        endCoord = Math.max(parseInt(coords[1]), startCoord + 5);
    }
    else if (coords.length == 1 && parseInt(coords[0])) {
        startCoord = parseInt(coords[0]);
        var brushSize = ext[1] - ext[0];
        endCoord = startCoord + brushSize;
    }
    startCoord = Math.max(0, startCoord);
    endCoord = Math.min(endCoord, x_mini.domain()[1]);
    startCoord = Math.min(startCoord, endCoord - minBrushExtent);
    clearInterval(timerAnimationSetCoords);
    if (animation) {
        var distance = Math.abs(startCoord - ext[0]);
        if (distance < 5) return;
        var distRange = distance / (ext[1] - ext[0]);
        if (distRange < 0.5) {
            brush.extent([startCoord, endCoord]);
            display();
            return
        }
        if (distRange > 50) {
            distRange = distRange * 0.05;
            var zoomDelta = (distRange - 1) * .5 * 100;
            brush.extent([ext[0] - zoomDelta, ext[1] + zoomDelta]);
        }
        var delta = Math.max(5, 0.05 * distance);
        ext = brush.extent();
        var numSteps = Math.max(1, parseInt(distance / delta));
        if (ext[0] > startCoord) delta = -delta;
        delta = (startCoord - ext[0]) / numSteps;
        timerAnimationSetCoords = setInterval(function() {
            ext = [ext[0] + delta, ext[1] + delta];
            if ((delta > 0 && ext[0] >= startCoord) || (delta < 0 && ext[0] <= startCoord)) {
                clearInterval(timerAnimationSetCoords);
                brush.extent([startCoord, endCoord]);
                display();
                return;
            }
            brush.extent(ext);
            display();
        }, 5)
    }
    else {
        brush.extent([startCoord, endCoord]);
        display();
    }
}

function appendLegend() {
    var menu = d3.select('body').append('div')
        .attr('id', 'legend')
        .attr('class', 'expanded');
    var block = menu.append('div')
        .attr('class', 'block')
        .style('float', 'left');
    var header = block.append('p')
        .style('text-align', 'center')
        .style('font-size', '16px')
        .style('margin-top', '5px')
        .text('Legend');
    var legend = block.append('svg:svg')
        .attr('width', "100%")
        .attr('class', 'legend');

    var legendHeight = 0;
    if (isContigSizePlot) legendHeight = appendLegendContigSize(legend);
    else legendHeight = appendLegendAlignmentViewer(legend);
    legend.attr('height', legendHeight);

    header.on('click', function() {
        menu.attr('class', function() {
            return menu.attr('class') == 'collapsed' ? 'expanded' : 'collapsed';
        });
        legend.attr('class', function() {
            return legend.attr('class') == 'collapsed' ? 'expanded' : 'collapsed';
        })
    });
}

function appendLegendAlignmentViewer(legend) {
    var classes = ['', 'similar', 'misassembled light_color', 'misassembled', 'misassembled similar', 'disabled', 'gene'];
    var classDescriptions = ['correct contigs', 'correct contigs similar among > 50% assemblies', 'misassembled blocks ' +
    '(misassembly event on the left side, on the right side)', 'misassembled blocks (zoom in to get details about misassembly event side)',
        'misassembled blocks similar among > 50% assemblies', 'unchecked misassembled blocks (see checkboxes)', 'genome features (e.g. genes)'];
    var prevOffsetY = 0;
    var offsetY = 0;
    for (var numClass = 0; numClass < classes.length; numClass++) {
        offsetY = addLegendItemWithText(legend, prevOffsetY, classes[numClass], classDescriptions[numClass]);
        if (classes[numClass] == 'misassembled light_color') {
            legend.append('path')
                .attr('transform',  function () {
                    return 'translate(0,' + prevOffsetY + ')';
                })
                .attr('class', function () {
                    return 'mainItem end misassembled';
                })
                .attr('d', function () {
                    var startX = 0;
                    var startY = 0;
                    path = ['M', startX, startY, 'L', startX + (Math.sqrt(1) * (legendItemHeight - startY) / 2),
                        (startY + (legendItemHeight - startY)) / 2, 'L', startX, legendItemHeight - startY, 'L',  startX, startY].join(' ');
                    return path;
                });
            legend.append('path')
                .attr('transform',  function () {
                    return 'translate(' + legendItemWidth + ',' + prevOffsetY + ')';
                })
                .attr('class', function () {
                    return 'mainItem end misassembled odd';
                })
                .attr('d', function () {
                    var startX = 0;
                    var startY = 0;
                    path = ['M', startX, startY, 'L', startX - (Math.sqrt(1) * (legendItemHeight - startY) / 2),
                        (startY + (legendItemHeight - startY)) / 2, 'L', startX, legendItemHeight - startY, 'L',  startX, startY].join(' ');
                    return path;
                });
        }
        prevOffsetY = offsetY;
    }
    return offsetY;
}

function appendLegendContigSize(legend) {
    if (items[0].contig_type && items[0].contig_type != 'unknown') {
        var classes = ['correct', 'misassembled', 'unaligned', 'unaligned_part'];
        var classMarks = ['', '', ''];
        var classDescriptions = ['correct contigs', 'misassembled contigs', 'unaligned contigs', 'unaligned parts of correct contigs'];
    }
    else {
        var classes = ['unknown', ''];
        var classMarks = ['', 'N50'];
        var classDescriptions = ['contigs', 'contig of length = Nx statistic (x is 50 or 75)'];
        for (var i = 0; i < items.length; i++) {
            if (items[i].marks && items[i].marks.search('NG') != -1) {
                classes = ['unknown', '', '', ''];
                classMarks = ['', 'N50', 'NG50', 'N50, NG50'];
                classDescriptions = ['contigs', 'contig of length = Nx statistic (x is 50 or 75)',
                    'contig of length = NGx statistic (x is 50 or 75)', 'contig of length = Nx and NGx simultaneously'];
                break;
            }
        }
    }
    var offsetY = 0;
    for (var numClass = 0; numClass < classes.length; numClass++) {
        offsetY = addLegendItemWithText(legend, offsetY, classes[numClass], classDescriptions[numClass], classMarks[numClass])
    }
    return offsetY;
}

function addLegendItemWithText(legend, offsetY, className, description, marks) {
    legend.append('g')
        .attr('class', 'block miniItem legend ' + className)
        .append('rect')
        .attr('width', legendItemWidth)
        .attr('height', legendItemHeight)
        .attr('x', 0)
        .attr('y', offsetY)
        .attr('fill', function (d) {
            d = {id: className};
            if (marks) return addGradient(d, marks, false);
        });
    legend.append('text')
        .attr('x', legendTextOffsetX)
        .attr('y', offsetY + 5)
        .attr('dy', '.5ex')
        .style('fill', 'white')
        .text(description)
        .call(wrap, 155, false, false, legendTextOffsetX, ' ');
    offsetY += legendItemHeight;
    offsetY += legendItemYSpace;
    offsetY += 10 * Math.max(0, Math.ceil(description.length / 13 - 3));
    return offsetY;
}

function setContigSizeThreshold(event, textBox) {
    var key = event.keyCode || this.event.keyCode;
    if (key == 27) {
        document.getElementById('input_contig_threshold').blur();
    }
    else {
        if (parseInt(textBox.value)) minContigSize = parseInt(textBox.value);
        else if (key == 13) minContigSize = 0;
        //only for contig size plot
        mini.selectAll('.block')
            .attr('opacity', function (d) {
                if (!d || !d.size) return 1;
                if (d.contig_type == "small_contigs") return paleContigsOpacity;
                return d.size > minContigSize ? 1 : paleContigsOpacity;
            });
        display();
    }
}

function addCoverageButtons() {
    var covMiniControls = document.getElementById('covMiniControls');
    var covMainControls = document.getElementById('covMainControls');
    setTrackBtnPos(covMiniControls, hideBtnCoverageMiniOffsetY - 10);
    setTrackBtnPos(covMainControls, hideBtnCoverageMainOffsetY - 10);
    btnsWidth = 100;
    covMiniControls.style.left = (margin.left + width - btnsWidth) + "px";
    covMainControls.style.left = (margin.left + width - btnsWidth) + "px";
    covMainControls.style.display = 'none';
}
