var totalMaxYMain;
var totalMaxYMini;
var minCoverage = 10;

function getItemStart(block, minExtent) {
    return x_main(Math.max(minExtent, block.corr_start));
}

function getItemEnd(block, maxExtent) {
    return x_main(Math.min(maxExtent, block.corr_end))
}

function getItemWidth(block, minExtent, maxExtent) {
    var widthOffset = 0;
    if (block.objClass && block.objClass.search('predicted_gene') != -1) {
        widthOffset = block.groupId == selected_id ? 2 : 1;
    }
    return getItemEnd(block, maxExtent) - getItemStart(block, minExtent) - widthOffset;
}

function getItemHeight(block) {
    if (block.objClass && block.objClass.search('predicted_gene') != -1) {
        return block.groupId == selected_id ? mainGenesSelectedHeight : mainGenesHeight;
    }
    return mainLanesHeight;
}

function getItemStrokeWidth(block, selected_id) {
    if (block.misassembledEnds) return 0;
    if (block.notActive) return .1;
    return (block.groupId == selected_id ? 3 : 1);
}

function getItemStrokeOpacity(block, selected_id) {
    if (block.misassembledEnds) return 0;
    return (block.groupId == selected_id ? 1 : .7);
}

function getItemOpacity(block) {
    var defOpacity = 0.65;
    if (block.contig_type == 'small_contigs')
        return paleContigsOpacity;
    if (isContigSizePlot && (!block.contig_type || block.contig_type == 'unaligned'))
        defOpacity = 1;
    if (block.misassembledEnds) return 1;
    if (block.fullContig && block.contig_type && block.contig_type != 'unaligned' && block.contig_type != 'small_contigs')
        return 0.05;
    if (!block || !block.size) return defOpacity;
    return block.size > minContigSize ? defOpacity : paleContigsOpacity;
}

function getTranslate(block, selected_id, minExtent) {
    if (block.misassembledEnds) {
        var x = block.misassembledEnds == "L" ? x_main(block.corr_start) : x_main(block.corr_end);
        var y = y_main(block.lane) + .25 * lanesInterval;
        //if (INTERLACE_BLOCKS_VERT_OFFSET) y += offsetsY[block.order % 3] * lanesInterval;
        if (block.groupId == selected_id) {
            if (block.misassembledEnds == "L") x += 1;
            else x += -1;
        }
        return 'translate(' + x + ', ' + y + ')';
    }
    var x = x_main(Math.max(minExtent, block.corr_start));
    var y = y_main(block.lane) + .25 * lanesInterval;
    if (INTERLACE_BLOCKS_VERT_OFFSET) y += offsetsY[block.order % 3] * lanesInterval;
    if (block.objClass && block.objClass.search('predicted_gene') != -1) {
        x += block.groupId == selected_id ? 1 : .5;
        y = y_main(block.lane) + mainLanesHeight * 0.6;
    }
    return 'translate(' + x + ', ' + y + ')';
}

function changeInfo(block) {
    info.selectAll('p')
        .remove();

    info.selectAll('span')
        .remove();
    setBaseChartHeight();
    info.append('p')
        .style({'display': 'block', 'word-break': 'break-all', 'word-wrap': 'break-word'})
        .text('Name: ' + block.name, 280);
    var contig_type;
    if (isContigSizePlot)
        contig_type = block.contig_type ? block.contig_type : '';
    else if (block.structure) {
        contig_type = block.misassemblies ? 'misassembled' : 'correct';
        if (block.similar == "True" && !block.misassemblies) contig_type += ' (similar in > 50% of the assemblies)';
        if (block.misassemblies) {
            var misassemblies = block.misassemblies.split(';');
            if (misassemblies[0] && misassemblies[1])
                contig_type += ' (both sides';
            else if (misassemblies[0])
                contig_type += ' (left side';
            else
                contig_type += ' (right side';

            if (block.similar == "True") contig_type += ', similar in > 50% of the assemblies';
            contig_type += ')'
        }
    }
    else if (block.best_group) {
        contig_type = 'alternative block (not from the best set)';
    }
    if (contig_type)
        info.append('p')
            .text('Type: ' + contig_type);
    if (block.size)
        info.append('p')
            .text('Size: ' + block.size + ' bp');

    var appendPositionElement = function(curBlock, selectedBlock, whereAppend, prevBlock, prevChr, isExpanded) {
        if (!curBlock) return;
        var whereAppendBlock = whereAppend;
        if (isExpanded) {
            whereAppendBlock = whereAppend.append('p')
                .attr('class', 'head_plus collapsed')
                .on('click', function() {
                    var eventX = d3.event.x || d3.event.clientX;
                    if (eventX < whereAppendBlock[0][0].offsetLeft + 15)
                        openClose(whereAppendBlock[0][0]);
                });
        }
        if (isExpanded || !isContigSizePlot) {
            appendBlock(whereAppendBlock, numBlock, curBlock, selectedBlock, prevBlock, prevChr, isExpanded);
            numBlock++;
        }

    };

    var numBlock = 0;
    var prevChr = '';
    var structure = block.structure ? block.structure : block.ambiguous_alignments;
    if (structure) {
        for (var i = 0; i < structure.length; i++) {
            var nextBlock = structure[i];
            if (nextBlock.contig_type != "M" && block.corr_start == nextBlock.corr_start && nextBlock.corr_end == block.corr_end) {
                prevChr = nextBlock.chr;
                break;
            }
        }
        appendPositionElement(nextBlock, block, info);
    }

    showArrows(block);
    structure = block.structure ? block.structure : block.best_group;
    if (structure && structure.length > 0) {
        var blocksMenu = info.append('p');
        var blocksCount = structure.filter(function(nextBlock) {
                if (nextBlock.contig_type != "M") return nextBlock;
            }).length;
        var blocksName = 'Blocks: ';
        if (block.ambiguous)
            blocksName = ' Alternatives: ';
        else if (block.ambiguous_alignments && block.ambiguous_alignments.length > 0)
            blocksName = 'Blocks of the best set: ';

        var blocksText = blocksName + blocksCount;
        var blocksMenuInfo = blocksMenu.append('span').text(block.ambiguous ? 'Ambiguously mapped.' : blocksText);
        if (block.ambiguous)
            blocksMenuInfo.append('span').text(blocksText);
        blocksMenuInfo.attr('class', 'head');
        blocksMenu.on('click', function() {
                        var eventX = d3.event.x || d3.event.clientX;
                        if (eventX < blocksMenu[0][0].offsetLeft + 15)
                            openClose(blocksMenu[0][0]);
                     });

        var blocksInfo = blocksMenuInfo.append('p');
        if (blocksCount > 5) {
            blocksMenu.attr('class', 'head_plus collapsed');
            blocksInfo.attr('class', 'close');
        }
        else {
            blocksMenu.attr('class', 'head_plus expanded');
            blocksInfo.attr('class', 'open');
        }

        for (var i = 0; i < structure.length; i++) {
            var nextBlock = structure[i];
            if (nextBlock.contig_type != "M") {
                appendPositionElement(nextBlock, nextBlock, blocksInfo, block, prevChr, true);

                if (block.ambiguous && i < structure.length - 1)
                    blocksInfo.append('p').text('or');
            } else {
                blocksInfo.append('p').text(nextBlock.msg);
            }
        }
    }
    if (block.genes) {
        var genesMenu = info.append('p');
        var genesText = 'Predicted genes: ' + block.genes.length;
        var genesInfo = genesMenu.append('span').text(genesText);

        if (block.contig_type == 'small_contigs' || block.genes.length == 0) {
            genesMenu.attr('class', 'head main');
        }
        else {
            genesInfo.attr('class', 'head');
            genesMenu.attr('class', 'head_plus collapsed')
                     .on('click', function() {
                        var eventX = d3.event.x || d3.event.clientX;
                        if (eventX < genesMenu[0][0].offsetLeft + 15)
                            openClose(genesMenu[0][0]);
                     });
            var genesCoordinatesInfo = genesInfo.append('p').attr('class', 'close');
            for (var i = 0; i < block.genes.length; i++) {
                genesCoordinatesInfo.append('p').text('Position: ')
                    .append('tspan').text(formatPosition(block.genes[i].start, block.genes[i].end, 'bp'));
            }
        }
    }
    if (block.overlaps && block.overlaps.length > 0) {
        var overlapsMenu = info.append('p').attr('class', 'head_plus collapsed');
        var overlapsText = 'Overlaps with other contigs: ' + block.overlaps.length;
        var overlapsMenuInfo = overlapsMenu.append('span').text(overlapsText);
        overlapsMenuInfo.attr('class', 'head');
        overlapsMenu.on('click', function() {
            var eventX = d3.event.x || d3.event.clientX;
            if (eventX < overlapsMenu[0][0].offsetLeft + 15)
                openClose(overlapsMenu[0][0]);
         });

        var overlapsInfo = overlapsMenuInfo.append('p').attr('class', 'close');
        for (var i = 0; i < block.overlaps.length; i++) {
            var nextBlock = block.overlaps[i];
            appendPositionElement(nextBlock, nextBlock, overlapsInfo, block, prevChr, true);
        }
    }
    if (block.ambiguous_alignments && block.ambiguous_alignments.length > 0) {
        var ambiguousMenu = info.append('p').attr('class', 'head_plus collapsed');
        var ambiguousText = 'Blocks of alternative sets: ' + block.ambiguous_alignments.filter(function(nextBlock) {
                if (nextBlock.contig_type != "M") return nextBlock;
            }).length;
        var ambiguousMenuInfo = ambiguousMenu.append('span').text(ambiguousText);
        ambiguousMenuInfo.attr('class', 'head');
        ambiguousMenu.on('click', function() {
                        var eventX = d3.event.x || d3.event.clientX;
                        if (eventX < ambiguousMenu[0][0].offsetLeft + 15)
                            openClose(ambiguousMenu[0][0]);
                     });

        var ambiguousInfo = ambiguousMenuInfo.append('p').attr('class', 'close');
        for (var i = 0; i < block.ambiguous_alignments.length; i++) {
            var nextBlock = block.ambiguous_alignments[i];
            if (nextBlock.contig_type != "M") {
                appendPositionElement(nextBlock, nextBlock, ambiguousInfo, block, prevChr, true);
            }
        }
    }
    var blockHeight = info[0][0].offsetHeight;
    curChartHeight += blockHeight;
    chart.attr('height', curChartHeight);
    display();
}

var ndash = String.fromCharCode(8211);

function appendBlock(whereAppendBlock, numBlock, curBlock, selectedBlock, prevBlock, prevChr, isExpanded) {

    var format = function (val) {
        val = val.toString();
        for (var i = 3; i < val.length; i += 4 )
            val = val.slice(0 , val.length - i) + ' ' + val.slice(length - i, val.length);
        return val;
    };

    var hasChromosomeLinks = typeof links_to_chromosomes !== 'undefined';
    var blockDiv = whereAppendBlock.append('span').attr('class', isExpanded ? 'head' : 'head main');
    if (isExpanded && !isContigSizePlot) {
        blockMark = blockDiv.append('div')
                            .attr('id', 'circle' + selectedBlock.corr_start + '_' + selectedBlock.corr_end);
        if (selectedBlock.corr_start == prevBlock.corr_start && selectedBlock.corr_end == prevBlock.corr_end && curBlock.chr == prevChr)
            blockMark.attr('class', 'block_circle selected');
        else
            blockMark.attr('class', 'block_circle');
    }
    var blockInfo = blockDiv.append('text');
    blockInfo.append('tspan')
            .attr('x', -50)
            .text('Position: ');
    if (isContigSizePlot) var positionLink = blockInfo.append('a');
    else positionLink = blockInfo.append('tspan');
    positionLink.attr('id', 'position_link' + numBlock)
        .style('cursor', 'pointer')
        .text(formatPosition(curBlock.start, curBlock.end, mainTickValue));
    var assembly = selectedBlock.assembly ? selectedBlock.assembly : prevBlock.assembly;
    if (isExpanded && !isContigSizePlot && chrContigs.indexOf(curBlock.chr) != -1)  // chromosome on this screen
        positionLink.style('text-decoration', 'underline')
            .style('color', '#7ED5F5')
            .on('click', function () {
                var brushExtent = brush.extent();
                var brushSize = brushExtent[1] - brushExtent[0];
                if (prevBlock && prevBlock.start > curBlock.corr_start) point = curBlock.corr_end;
                else if (prevBlock) point = curBlock.corr_start;
                setCoords([point - brushSize / 2, point + brushSize / 2], true);
                for (var i = 0; i < items.length; i++) {
                    if (items[i].assembly == assembly && items[i].name == selectedBlock.contig &&
                        items[i].corr_start == curBlock.corr_start && items[i].corr_end == curBlock.corr_end) {
                        selected_id = items[i].groupId;
                        showArrows(items[i]);
                        changeInfo(items[i]);
                        display();
                        break;
                    }
                }
                d3.event.stopPropagation();
            });
    if (!isContigSizePlot && prevBlock) {
        if (curBlock.contig != prevBlock.name)
            blockInfo.append('span').text('(' + curBlock.contig + ')');
    }
    if (isContigSizePlot) {
        if (curBlock.start_in_ref) {
            var link = hasChromosomeLinks ? links_to_chromosomes[curBlock.chr] : 'alignment_viewer';
            link += '.html';
            link += '?assembly=' + assembly + '&contig=' + curBlock.contig  + '&start=' + curBlock.start_in_ref + '&end=' + curBlock.end_in_ref;
            positionLink.attr('href', link)
                .attr('target', '_blank')
                .style('text-decoration', 'underline')
                .style('color', '#7ED5F5');
            if (curBlock.chr) {
                if (hasChromosomeLinks)
                    positionLink.append('span').text('(' + curBlock.chr + ')');
                else blockInfo.append('span').text('(' + curBlock.chr + ')');
            }
        }
        else {
            positionLink.text('unaligned');
            positionLink.style('text-decoration', 'none')
                .style('color', 'white');
        }
    }
    if (!isContigSizePlot) {
        if (chrContigs.indexOf(curBlock.chr) == -1) {
            var link = hasChromosomeLinks ? links_to_chromosomes[curBlock.chr] : curBlock.chr;
            link += '.html';
            link += '?assembly=' + assembly + '&contig=' + selectedBlock.contig  + '&start=' + curBlock.corr_start + '&end=' + curBlock.corr_end;
            blockInfo.append('a')
                .attr('href', link)
                .attr('target', '_blank')
                .style('text-decoration', 'underline')
                .style('color', '#7ED5F5')
                .text('(' + curBlock.chr + ')');
        }
        else if (chrContigs.length > 1) {
            blockInfo.append('span').text('(' + curBlock.chr + ')');
        }
    }
    blockInfo = blockInfo.append('p').attr('class', isExpanded ? 'close' : 'open');

    if (curBlock.start) {
        var referenceText = ['reference:', format(curBlock.start), ndash, format(curBlock.end),
                    '(' + format(Math.abs(curBlock.end - curBlock.start) + 1) + ')', 'bp'].join(' ');
        blockInfo.append('p').text(referenceText);
    }
    var contigText = ['contig:', format(curBlock.start_in_contig), ndash,  format(curBlock.end_in_contig),
            '(' + format(Math.abs(curBlock.end_in_contig - curBlock.start_in_contig) + 1) + ')', 'bp'].join(' ');
    blockInfo.append('p').text(contigText);
    if (curBlock.IDY)
        blockInfo.append('p').text(['IDY:', curBlock.IDY, '%'].join(' '));
}

function formatPosition(start, end, tickValue){
    return [formatValue(start, tickValue), ndash, formatValue(end, tickValue),
        tickValue, ' '].join(' ');
}

function showArrows(block) {
    var verticalShift = -7;
    arrows = [];
    mini.selectAll('.arrow').remove();
    mini.selectAll('.arrow_selected').remove();
    var y = y_mini(block.lane) - 1;

    if (block.structure) {
        for (var i = 0; i < block.structure.length; ++i) {
            var nextBlock = block.structure[i];
            if (nextBlock.contig_type != "M" && !nextBlock.notActive) {
                if (!(nextBlock.corr_start <= block.corr_start && block.corr_end <= nextBlock.corr_end) &&
                    (isContigSizePlot || chrContigs.indexOf(nextBlock.chr) != -1)) {
                    arrows.push({start: nextBlock.corr_start, end: nextBlock.corr_end, lane: block.lane, selected: false});
                    mini.append('g')
                        .attr('transform', 'translate(' + x_mini((nextBlock.corr_end + nextBlock.corr_start) / 2) + ',' + verticalShift +')')
                        .attr('class', 'arrow')
                        .append("svg:path")
                        .attr("d", 'M0,0V' + (Math.abs(verticalShift) + 1 + block.lane * miniLanesHeight))
                        .attr("class", function () {
                            return "path arrow";
                        })
                        .attr("marker-start", function () {
                            return "url(#start_arrow)";
                        })
                        .attr("marker-end", function () {
                            return "url(#arrow)";
                        });
                }
            }
        }
    }

    arrows.push({start: block.corr_start, end: block.corr_end, lane: block.lane, selected: true});
    mini.append('g')
        .attr('transform', 'translate(' + x_mini((block.corr_end + block.corr_start) / 2) + ',' + verticalShift +')')
        .attr('class', 'arrow_selected')
        .append("svg:path")
        .attr("d", 'M0,0V' + (Math.abs(verticalShift) + 1 + block.lane * miniLanesHeight))
        .attr("class", function () {
            return "path arrow_selected";
        })
        .attr("marker-start", function () {
            return "url(#start_arrow_selected)";
        })
        .attr("marker-end", function () {
            return "url(#arrow_selected)";
        });
    display();
}

function showMisassemblies() {
    for (var numItem = 0; numItem < items.length; numItem++) {
        if (items[numItem].misassemblies) {
            items[numItem] = changeMisassembledStatus(items[numItem]);
            if (items[numItem].triangles && items[numItem].triangles.length > 0)
                for (var i = 0; i < items[numItem].triangles.length; i++) {
                    if (!items[numItem].triangles[i].objClass) items[numItem].triangles[i].objClass = "misassembled";
                    items[numItem].triangles[i] = changeMisassembledStatus(items[numItem].triangles[i]);
                }
        }
    }
    hideUncheckedMisassemblies(itemsContainer);
    hideUncheckedMisassemblies(chart);
}

function changeMisassembledStatus(block) {
    var msTypes = block.misassemblies.split(';');
    var isMisassembled = "False";
    for (var i = 0; i < msTypes.length; i++) {
        if (msTypes[i] && document.getElementById(msTypes[i]).checked) isMisassembled = "True";
    }
    if (isMisassembled == "True" && block.misassembled == "False") {
        block.objClass = block.objClass.replace("disabled", "misassembled");
    }
    else if (isMisassembled == "False")
        block.objClass = block.objClass.replace(/\bmisassembled\b/g, "disabled");
    block.misassembled = isMisassembled;
    return block;
}

function hideUncheckedMisassemblies(track) {
    track.selectAll('.block')
        .classed('misassembled', function (block) {
            if (block && block.misassemblies) {
                if (block.misassembled) return block.misassembled == 'True';
                return checkMsTypeToShow(block);
            }
        })
        .classed('disabled', function (block) {
            if (block && block.misassemblies) {
                if (block.misassembled) return block.misassembled != 'True';
                return !checkMsTypeToShow(block);
            }
        });
    track.selectAll('path')
        .classed('misassembled', function (block) {
            if (block && block.misassemblies)
                return checkMsTypeToShow(block);
        })
        .classed('disabled', function (block) {
            if (block && block.misassemblies)
                return !checkMsTypeToShow(block);
        });
}

function checkMsTypeToShow(block) {
    var msTypes = block.misassemblies.split(';');
    for (var i = 0; i < msTypes.length; i++) {
        if (msTypes[i] && document.getElementById(msTypes[i]).checked) return true;
    }
    return false;
}

function addTooltipTspan(displayedText, tspan, width) {
    var visibleLabel = getVisibleText(displayedText, width);
    if (visibleLabel.length < displayedText.length) {
        var fullName = displayedText;
        tspan.on('mouseover',function(d) {
            addTooltip(d, '<span class="lane_tooltip">' + fullName + '</span>');
        });
        tspan.on('mouseout',function(d) {
            removeTooltip();
        });
        displayedText = visibleLabel;
    }
    return displayedText
}

function wrap(text, width, cutText, addStdoutLink, offsetX, separator) {
    var stdoutLinkWidth = getSize('(text)') + 10;
    text.each(function() {
        var text = d3.select(this),
            words = text.text().split(separator).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1,
            y = text.attr('y'),
            dy = parseFloat(text.attr('dy')),
            tspan = text.text(null).append('tspan').attr('x', addStdoutLink ? -stdoutLinkWidth : offsetX)
                .attr('y', y).attr('dy', dy + 'em')
                .style('font-weight', 'bold');
        var firstLine = true;
        while (word = words.pop()) {
            line.push(word);
            var displayedText = line.join(' ');
            tspan.text(displayedText);
            var doCut = firstLine && cutText;
            if ((tspan.node().getComputedTextLength() > width || doCut) && line.length > 1) {
                line.pop();
                displayedText = line.join(' ');
                displayedText = doCut ? addTooltipTspan(line[0], tspan, width) : displayedText;
                tspan.text(displayedText);
                line = [word];
                if (firstLine && addStdoutLink) {
                    linkAdded = true;
                    tspan = text.append('tspan')
                        .attr('x', offsetX)
                        .attr('y', y)
                        .attr('dy', lineNumber * lineHeight + dy + 'em')
                        .attr('text-decoration', 'underline')
                        .attr('fill', '#0000EE')
                        .style("cursor", "pointer")
                        .text('(text)')
                        .on('click',function(d) {
                            window.open(d.link, '_blank');
                            d3.event.stopPropagation();
                        });
                }
                firstLine = false;
                if (word.search("\\+") != -1) {
                    tspan = text.append('tspan')
                        .attr('x', offsetX)
                        .attr('y', y)
                        .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                        .text(word);
                    var msWords = word.split('+');
                    var misassemblies = msWords[0];
                    var extMisassemblies = misassemblies.split(' ')[1];
                    var localMisassemblies = msWords[1];
                    var msTooltip = extMisassemblies + ' extensive + ' + localMisassemblies + ' local misassemblies';
                    tspan.on('mouseover',function(d) {
                        addTooltip(d, '<span class="lane_tooltip">' + msTooltip + '</span>');
                    });
                    tspan.on('mouseout',function(d) {
                        removeTooltip();
                    });
                }
                else {
                    tspan = text.append('tspan')
                        .attr('x', offsetX)
                        .attr('y', y)
                        .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                        .text(word);
                }
            }
            else if (doCut) {
                displayedText = addTooltipTspan(line[0], tspan, width);
                tspan.text(displayedText);
            }
        }
    });
}

function getCoordsFromURL() {
    var query = document.location.search;
    query = query.split('+').join(' ');

    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(query)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    if (params && params.assembly && params.contig && params.start && params.end) {
        var delta = 1000;
        setCoords([parseInt(params.start) - delta, parseInt(params.end) + delta]);
        for (var i = 0; i < items.length; i++) {
            if (items[i].assembly == params.assembly && items[i].name == params.contig &&
                items[i].corr_start == params.start && items[i].corr_end == params.end) {
                selected_id = items[i].groupId;
                showArrows(items[i]);
                changeInfo(items[i]);
                display();
                break;
            }
        }
    }
    return params;
}

function getText(textItem, minExtent, maxExtent) {
    if (!textItem.name && !textItem.label) return;
    var drawLimit = letterSize * 3;
    if (textItem.label) {
        return getVisibleText(textItem.label, visibleLength);
    }
    var visibleLength = getItemWidth(textItem, minExtent, maxExtent) - 20;
    if (visibleLength > drawLimit)
        return getVisibleText(textItem.name, visibleLength, textItem.len);
}

function addTooltip(feature, tooltipText, event) {
    if (!tooltipText)
        tooltipText = feature ? '<strong>' + (feature.name ? feature.name + ',' : '') + '</strong> <span>' +
        (feature.id ? ' ID=' + feature.id + ',' : '') + ' coordinates: ' + feature.start + '-' + feature.end + '</span>' : '';
    var eventX = event ? event.pageX : d3.event.pageX - 50;
    var eventY = event ? event.pageY + 5 : d3.event.pageY + 5;
    if (tooltipText && featureTip.html() != tooltipText) {
        featureTip.style('opacity', 1);
        featureTip.html(tooltipText)
            .style('left', eventX + 'px')
            .style('top', eventY + 'px');
    }
    else removeTooltip();
}

function removeTooltip() {
    featureTip.style('opacity', 0);
    featureTip.html('');
}

function getTickValue(value) {
    if (value > 1000000000)
        return 'Gbp';
    else if (value > 1000000)
        return 'Mbp';
    else if (value > 1000)
        return 'kbp';
    else
        return 'bp';
}

function formatValue(d, tickValue) {
    d = Math.round(d);
    if (tickValue == 'Gbp')
        return d3.round(d / 1000000000, 2);
    else if (tickValue == 'Mbp')
        return d3.round(d / 1000000, 2);
    else if (tickValue == 'kbp')
        return d3.round(d / 1000, 2);
    else
        return d;
}

function getTextSize(text, size) {
    return text.length * size;
}

function getVisibleText(fullText, l, lenChromosome) {
    var t = '';
    if ((fullText.length - 1) * letterSize > l) {
        t = fullText.slice(0, fullText.length - 1);
        while ((t.length - 1) * letterSize > l && t.length > 3) {
            t = fullText.slice(0, t.length - 1);
        }
    }
    else t = fullText;
    if (lenChromosome && t.length == fullText.length) {
        var t_plus_len = fullText + ' (' + lenChromosome + ' bp)';
        if ((t_plus_len.length - 2)* letterSize <= l) return t_plus_len;
    }
    return (t.length < fullText.length && t.length <= 3 ? '' : t + (t.length >= fullText.length ? '' : '...'));
}

function getSize(text) {
    var tmp = document.createElement("span");
    tmp.innerHTML = text;
    tmp.style.visibility = "hidden";
    tmp.className = "itemLabel";
    tmp.style.whiteSpace = "nowrap";
    document.body.appendChild(tmp);
    size = tmp.offsetWidth;
    document.body.removeChild(tmp);
    return size;
}

function glow() {
    var selectedItem = d3.select(this);
    itemsContainer.append('rect')
        .attr('class', 'glow')
        .attr('pointer-events', 'none')
        .attr('width', selectedItem.attr('width'))
        .attr('height', selectedItem.attr('height'))
        .attr('fill', 'white')
        .attr('opacity', .3)
        .attr('transform', selectedItem.attr('transform'));
}

function disglow() {
    itemsContainer.select('.glow').remove();
}

function selectFeature() {
    d3.select(this)
        .transition()
        .style({'opacity': .5})
        .select('rect');
}

function deselectFeature() {
    d3.select(this)
        .transition()
        .style({'opacity': 1})
        .select('rect');
}

function openClose(d) {
    var c = d3.select(d);
    if (c.attr('class') == 'head_plus expanded' || c.attr('class') == 'head_plus collapsed' ){
        c.attr('class', c.attr('class') == 'head_plus expanded' ? 'head_plus collapsed' : 'head_plus expanded');
        p = c.select('span').select('p');
        if (p.attr('class') == 'close') {
            p.attr('class', 'open');
            var blockHeight = c[0][0].offsetHeight;
            curChartHeight += blockHeight;
        }
        else {
            var blockHeight = c[0][0].offsetHeight;
            curChartHeight -= blockHeight;
            p.attr('class', 'close');
        }
        chart.attr('height', curChartHeight);
    }
    d3.event.stopPropagation();
}

function addGradient(d, marks, gradientExists) {
    if (!marks) return;
    var gradientId = 'gradient' + d.id;
    marks = marks.split(', ');
    if (marks.length == 1) return contigsColors[marks[0]];
    if (gradientExists) return 'url(#' + gradientId + ')';
    var gradient = chart.append("svg:defs")
        .append("svg:linearGradient")
        .attr("id", gradientId);
    gradient.attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
    gradientSteps = ["50%", "50%"];

    for (var m = 0; m < marks.length; m++)
        gradient.append("svg:stop")
            .attr("offset", gradientSteps[m])
            .attr("stop-color", contigsColors[marks[m]])
            .attr("stop-opacity", 1);

    return 'url(#' + gradientId + ')';
}

function getNextMaxCovValue(maxY, ticksVals) {
    factor = ticksVals[1] - ticksVals[0];
    maxY = Math.max(factor, Math.ceil(maxY / factor) * factor);
    return maxY;
}

function getLogScaleYValues(scale) {
    return function(tickValue) {
        var i = 0;
        for (; Math.pow(10, i) < tickValue; ++i);
        if (tickValue == Math.pow(10, i) && tickValue <= scale.domain()[0]) return tickValue;
    }
};

function changeMaxMainCoverage(zoomIn) {
    if (zoomIn){
        totalMaxYMain = Math.max(totalMaxYMain / 2, minCoverage);
        if (totalMaxYMain == minCoverage) {
            document.getElementById('zoomInCoverageMain').disabled = true;
        }
        document.getElementById('zoomOutCoverageMain').disabled = false;
    }
    else {
        totalMaxYMain = Math.min(totalMaxYMain * 2, y_max);
        if (totalMaxYMain == y_max) {
            document.getElementById('zoomOutCoverageMain').disabled = true;
        }
        document.getElementById('zoomInCoverageMain').disabled = false;
    }
    y_cov_main_S = setYScaleCoverage(totalMaxYMain);
    setYScaleLabels(main_cov, y_cov_main_A, y_cov_main_S);
    updateMainCoverage();
}

function changeMaxMiniCoverage(zoomIn) {
    if (zoomIn){
        totalMaxYMini = Math.max(totalMaxYMini / 2, minCoverage);
        if (totalMaxYMini == minCoverage) {
            document.getElementById('zoomInCoverageMini').disabled = true;
        }
        document.getElementById('zoomOutCoverageMini').disabled = false;
    }
    else {
        totalMaxYMini = Math.min(totalMaxYMini * 2, y_max);
        if (totalMaxYMini == y_max) {
            document.getElementById('zoomOutCoverageMini').disabled = true;
        }
        document.getElementById('zoomInCoverageMini').disabled = false;
    }
    y_cov_mini_S = setYScaleCoverage(totalMaxYMini);
    setYScaleLabels(mini_cov, y_cov_mini_A, y_cov_mini_S);
    updateMiniCoverage();
}

function updateMiniCoverage() {
    if (typeof physical_coverage_data !== 'undefined')
        drawCoverageLine(x_mini.domain()[0], x_mini.domain()[1], false,
            physical_coverage_data, '.phys_covered');
    drawCoverageLine(x_mini.domain()[0], x_mini.domain()[1], false, coverage_data, '.covered');
}

function resetMaxMainCoverage() {
    totalMaxYMain = y_max;
    y_cov_main_S = setYScaleCoverage(totalMaxYMain);
    setYScaleLabels(main_cov, y_cov_main_A, y_cov_main_S);
    updateMainCoverage();
    document.getElementById('zoomOutCoverageMain').disabled = true;
}

function resetMaxMiniCoverage() {
    totalMaxYMini = y_max;
    y_cov_mini_S = setYScaleCoverage(totalMaxYMini);
    setYScaleLabels(mini_cov, y_cov_mini_A, y_cov_mini_S);
    updateMiniCoverage();
    document.getElementById('zoomOutCoverageMini').disabled = true;
}

function setYScaleCoverage(maxValue) {
    y_cov_scale = d3.scale.linear();
    if (!maxValue) {
        y_max = getNextMaxCovValue(y_max, y_cov_scale.ticks(numYTicks));
        maxValue = y_max;
    }
    y_cov_scale.domain([maxValue, .1])
               .range([0, coverageHeight]);
    return y_cov_scale;
}

function setYScaleLabels(track, axis, scale) {
    axis.scale(scale);
    track.select('.y').call(axis);
}

function setBaseChartHeight() {
    curChartHeight = baseChartHeight;
    chart.attr('height', curChartHeight);
}

function addClickContigText(info) {
    p = info.append('p');
    p.text('<click on a contig to get details>');
    p.attr('class', 'click_a_contig_text');
}

function addSelectionAreas() {
    brush = drawBrush(mini, miniHeight);
    if (!featuresHidden)
        brush_anno = drawBrush(annotationsMini, annotationsMiniHeight, 'features');
    if (drawCoverage)
        brush_cov = drawBrush(mini_cov, coverageHeight, 'coverage');
}

function getNumberOfContigs(x) {
    lineCountContigs.selectAll('g')
        .remove();
    for (var block = 0; block < visRects.length; block++) {
        if (x_main(visRects[block].corr_start) <= x && x <= x_main(visRects[block].corr_end)) {
            var curItem = visRects[block];
            if (curItem.objClass && curItem.objClass.search("disabled") != -1 || curItem.notActive)
                continue;
            order = (curItem.order + 1).toString();
            offsetY = y_main(curItem.lane) + mainLanesHeight / 2;
            var suffix = 'th';
            var lastNumber = order.slice(-1);
            if (lastNumber == '1' && order != "11") suffix = 'st';
            else if (lastNumber == '2' && order != "12") suffix = 'nd';
            else if (lastNumber == '3' && order != "13") suffix = 'rd';
            var container = lineCountContigs.append('g')
                .attr('transform', function (d) {
                    return 'translate(-3, ' + offsetY + ')';
                })
                .attr('width', function (d) {
                });
            var numberLabel = container.append('text')
                .text(order + suffix + ' contig')
                .attr('text-anchor', 'end')
                .attr('class', 'itemLabel');
            var labelRect = numberLabel.node().getBBox();
            container.insert('rect', 'text')
                .attr('x', labelRect.x - 2)
                .attr('y', labelRect.y)
                .attr('height', labelRect.height + 2)
                .attr('width', labelRect.width + 5)
                .attr('fill', '#fff');
        }
    }
}