############################################################################
# Copyright (c) 2015-2016 Saint Petersburg State University
# Copyright (c) 2011-2015 Saint Petersburg Academic University
# All Rights Reserved
# See file LICENSE for details.
############################################################################
from quast_libs import qconfig


def analyze_coverage(ca_output, regions, ref_aligns, ref_features, snps, total_indels_info):
    uncovered_regions = 0
    uncovered_region_bases = 0
    total_redundant = 0

    region_covered = 0
    region_ambig = 0
    gaps = []
    neg_gaps = []
    redundant = []
    snip_left = 0
    snip_right = 0

    # for counting short and long indels
    # indels_list = []  # -- defined earlier
    prev_snp = None
    cur_indel = 0

    nothing_aligned = True
    #Go through each header in reference file
    for ref, value in regions.iteritems():
        #Check to make sure this reference ID contains aligns.
        if ref not in ref_aligns:
            print >> ca_output.stdout_f, 'ERROR: Reference %s does not have any alignments!  ' \
                                          'Check that this is the same file used for alignment.' % ref
            print >> ca_output.stdout_f, 'ERROR: Alignment Reference Headers: %s' % ref_aligns.keys()
            continue
        nothing_aligned = False

        #Sort all alignments in this reference by start location
        sorted_aligns = sorted(ref_aligns[ref], key=lambda x: x[0])
        total_aligns = len(sorted_aligns)
        print >> ca_output.stdout_f, '\tReference %s: %d total alignments. %d total regions.' % (ref, total_aligns, len(regions[ref]))

        # the rest is needed for SNPs stats only
        if not qconfig.show_snps:
            continue

        #Walk through each region on this reference sequence
        for region in regions[ref]:
            end = 0
            reg_length = region[1] - region[0] + 1
            print >> ca_output.stdout_f, '\t\tRegion: %d to %d (%d bp)' % (region[0], region[1], reg_length)

            #Skipping alignments not in the next region
            while sorted_aligns and sorted_aligns[0][1] < region[0]:
                skipped = sorted_aligns[0]
                sorted_aligns = sorted_aligns[1:] # Kolya: slooow, but should never happens without gff :)
                print >> ca_output.stdout_f, '\t\t\tThis align occurs before our region of interest, skipping: %s' % skipped

            if not sorted_aligns:
                print >> ca_output.stdout_f, '\t\t\tThere are no more aligns. Skipping this region.'
                continue

            #If region starts in a contig, ignore portion of contig prior to region start
            if sorted_aligns and region and sorted_aligns[0][0] < region[0]:
                print >> ca_output.stdout_f, '\t\t\tSTART within alignment : %s' % sorted_aligns[0]
                #Track number of bases ignored at the start of the alignment
                snip_left = region[0] - sorted_aligns[0][0]
                #Modify to account for any insertions or deletions that are present
                for z in xrange(sorted_aligns[0][0], region[0] + 1):
                    if (ref in snps) and (sorted_aligns[0][8] in snps[ref]) and (z in snps[ref][sorted_aligns[0][8]]) and \
                       (ref in ref_features) and (z in ref_features[ref]) and (ref_features[ref][z] != 'A'): # Kolya: never happened before because of bug: z -> i
                        for cur_snp in snps[ref][sorted_aligns[0][8]][z]:
#                            if cur_snp.type == 'I':
                            if cur_snp[6] == 'I':
                                snip_left += 1
#                            elif cur_snp.type == 'D':
                            elif cur_snp[6] == 'D':
                                snip_left -= 1

                #Modify alignment to start at region
                print >> ca_output.stdout_f, '\t\t\t\tMoving reference start from %d to %d' % (sorted_aligns[0][0], region[0])
                sorted_aligns[0][0] = region[0]

                #Modify start position in contig
                if sorted_aligns[0][2] < sorted_aligns[0][3]:
                    print >> ca_output.stdout_f, '\t\t\t\tMoving contig start from %d to %d.' % (sorted_aligns[0][2],
                                                                                                  sorted_aligns[0][2] + snip_left)
                    sorted_aligns[0][2] += snip_left
                else:
                    print >> ca_output.stdout_f, '\t\t\t\tMoving contig start from %d to %d.' % (sorted_aligns[0][2],
                                                                                                  sorted_aligns[0][2] - snip_left)
                    sorted_aligns[0][2] -= snip_left

            #No aligns in this region
            if sorted_aligns[0][0] > region[1]:
                print >> ca_output.stdout_f, '\t\t\tThere are no aligns within this region.'
                gaps.append([reg_length, 'START', 'END'])
                #Increment uncovered region count and bases
                uncovered_regions += 1
                uncovered_region_bases += reg_length
                continue

            #Record first gap, and first ambiguous bases within it
            if sorted_aligns[0][0] > region[0]:
                size = sorted_aligns[0][0] - region[0]
                print >> ca_output.stdout_f, '\t\t\tSTART in gap: %d to %d (%d bp)' % (region[0], sorted_aligns[0][0], size)
                gaps.append([size, 'START', sorted_aligns[0][8]])
                #Increment any ambiguously covered bases in this first gap
                for i in xrange(region[0], sorted_aligns[0][1]):
                    if (ref in ref_features) and (i in ref_features[ref]) and (ref_features[ref][i] == 'A'):
                        region_ambig += 1

            #For counting number of alignments
            counter = 0
            negative = False
            current = None
            while sorted_aligns and sorted_aligns[0][0] < region[1] and not end:
                #Increment alignment count
                counter += 1
                if counter % 1000 == 0:
                    print >> ca_output.stdout_f, '\t...%d of %d' % (counter, total_aligns)
                end = False
                #Check to see if previous gap was negative
                if negative:
                    print >> ca_output.stdout_f, '\t\t\tPrevious gap was negative, modifying coordinates to ignore overlap'
                    #Ignoring OL part of next contig, no SNPs or N's will be recorded
                    snip_left = current[1] + 1 - sorted_aligns[0][0]
                    #Account for any indels that may be present
                    for z in xrange(sorted_aligns[0][0], current[1] + 2):
                        if (ref in snps) and (sorted_aligns[0][8] in snps[ref]) and (z in snps[ref][sorted_aligns[0][8]]):
                            for cur_snp in snps[ref][sorted_aligns[0][8]][z]:
#                                if cur_snp.type == 'I':
                                if cur_snp[6] == 'I':
                                    snip_left += 1
#                                elif cur_snp.type == 'D':
                                elif cur_snp[6] == 'D':
                                    snip_left -= 1
                    #Modifying position in contig of next alignment
                    sorted_aligns[0] = list(sorted_aligns[0])
                    sorted_aligns[0][0] = current[1] + 1
                    if sorted_aligns[0][2] < sorted_aligns[0][3]:
                        print >> ca_output.stdout_f, '\t\t\t\tMoving contig start from %d to %d.' % (sorted_aligns[0][2],
                                                                                                      sorted_aligns[0][2] + snip_left)
                        sorted_aligns[0][2] += snip_left
                    else:
                        print >> ca_output.stdout_f, '\t\t\t\tMoving contig start from %d to %d.' % (sorted_aligns[0][2],
                                                                                                      sorted_aligns[0][2] - snip_left)
                        sorted_aligns[0][2] -= snip_left
                    negative = False
                    sorted_aligns[0] = tuple(sorted_aligns[0])

                #Pull top alignment
                current = sorted_aligns[0]
                sorted_aligns = sorted_aligns[1:]
                print >>ca_output.stdout_f, '\t\t\tAlign %d: %s' % (counter, '%d %d %s %d %d' % (current[0], current[1],
                                                                                                  current[8], current[2], current[3]))

                #Check if:
                # A) We have no more aligns to this reference
                # B) The current alignment extends to or past the end of the region
                # C) The next alignment starts after the end of the region

                if not sorted_aligns or current[1] >= region[1] or sorted_aligns[0][0] > region[1]:
                    #Check if last alignment ends before the regions does (gap at end of the region)
                    if current[1] >= region[1]:
                        current = list(current)
                        #print "Ends inside current alignment.\n";
                        print >> ca_output.stdout_f, '\t\t\tEND in current alignment.  Modifying %d to %d.' % (current[1], region[1])
                        #Pushing the rest of the alignment back on the stack
                        sorted_aligns = [current] + sorted_aligns
                        #Flag to end loop through alignment
                        end = True
                        #Clip off right side of contig alignment
                        snip_right = current[1] - region[1]
                        #End current alignment in region
                        current[1] = region[1]
                        current = tuple(current)
                    else:
                        #Region ends in a gap
                        size = region[1] - current[1]
                        print >> ca_output.stdout_f, '\t\t\tEND in gap: %d to %d (%d bp)' % (current[1], region[1], size)

                        #Record gap
                        if not sorted_aligns:
                            #No more alignments, region ends in gap.
                            gaps.append([size, current[8], 'END'])
                        else:
                            #Gap between end of current and beginning of next alignment.
                            gaps.append([size, current[8], sorted_aligns[0][8]])
                        #Increment any ambiguous bases within this gap
                        for i in xrange(current[1], region[1]):
                            if (ref in ref_features) and (i in ref_features[ref]) and (ref_features[ref][i] == 'A'):
                                region_ambig += 1
                else:
                    #Grab next alignment
                    next = sorted_aligns[0]

                    if next[1] <= current[1]:
                        #The next alignment is redundant to the current alignmentt
                        while next[1] <= current[1] and sorted_aligns:
                            total_redundant += next[1] - next[0] + 1
                            print >> ca_output.stdout_f, '\t\t\t\tThe next alignment (%d %d %s %d %d) is redundant. Skipping.' \
                                                     % (next[0], next[1], next[8], next[2], next[3])
                            redundant.append(current[8])
                            sorted_aligns = sorted_aligns[1:]
                            if sorted_aligns:
                                next = sorted_aligns[0]
                                counter += 1
                            else:
                                #Flag to end loop through alignment
                                end = True

                    if not end:
                        if next[0] > current[1] + 1:
                            #There is a gap beetween this and the next alignment
                            size = next[0] - current[1] - 1
                            gaps.append([size, current[8], next[8]])
                            print >> ca_output.stdout_f, '\t\t\t\tGap between this and next alignment: %d to %d (%d bp)' % \
                                                          (current[1], next[0], size)
                            #Record ambiguous bases in current gap
                            for i in xrange(current[1], next[0]):
                                if (ref in ref_features) and (i in ref_features[ref]) and (ref_features[ref][i] == 'A'):
                                    region_ambig += 1
                        elif next[0] <= current[1]:
                            #This alignment overlaps with the next alignment, negative gap
                            #If contig extends past the region, clip
                            if current[1] > region[1]:
                                current[1] = region[1]
                            #Record gap
                            size = next[0] - current[1]
                            neg_gaps.append([size, current[8], next[8]])
                            print >>ca_output.stdout_f, '\t\t\t\tNegative gap (overlap) between this and next alignment: ' \
                                                         '%d to %d (%d bp)' % (current[1], next[0], size)

                            #Mark this alignment as negative so overlap region can be ignored
                            negative = True
                        print >> ca_output.stdout_f, '\t\t\t\tNext Alignment: %d %d %s %d %d' % (next[0], next[1],
                                                                                                  next[8], next[2], next[3])

                #Initiate location of SNP on assembly to be first or last base of contig alignment
                contig_estimate = current[2]
                enable_SNPs_output = False
                if enable_SNPs_output:
                    print >> ca_output.stdout_f, '\t\t\t\tContig start coord: %d' % contig_estimate

                #Assess each reference base of the current alignment
                for i in xrange(current[0], current[1] + 1):
                    #Mark as covered
                    region_covered += 1

                    if current[2] < current[3]:
                        pos_strand = True
                    else:
                        pos_strand = False

                    #If there is a misassembly, increment count and contig length
                    #if (exists $ref_features{$ref}[$i] && $ref_features{$ref}[$i] eq "M") {
                    #	$region_misassemblies++;
                    #	$misassembled_contigs{$current[2]} = length($assembly{$current[2]});
                    #}

                    #If there is a SNP, and no alternative alignments over this base, record SNPs
                    if (ref in snps) and (current[8] in snps[ref]) and (i in snps[ref][current[8]]):
                        cur_snps = snps[ref][current[8]][i]
                        # sorting by pos in contig
                        if pos_strand:
                            cur_snps = sorted(cur_snps, key=lambda x: x[3])
#                            cur_snps = sorted(cur_snps, key=lambda x: x.ctg_pos)
                        else: # for reverse complement
                            cur_snps = sorted(cur_snps, key=lambda x: x[3], reverse=True)
#                            cur_snps = sorted(cur_snps, key=lambda x: x.ctg_pos, reverse=True)

                        for cur_snp in cur_snps:
                            if enable_SNPs_output:
                                print >> ca_output.stdout_f, '\t\t\t\tSNP: %s, reference coord: %d, contig coord: %d, estimated contig coord: %d' % \
                                         (cur_snp[6], i, cur_snp[3], contig_estimate)
#                                         (cur_snp.type, i, cur_snp.ctg_pos, contig_estimate)

                            #Capture SNP base
#                            snp = cur_snp.type
                            snp = cur_snp[6]

                            #Check that the position of the SNP in the contig is close to the position of this SNP
#                            if abs(contig_estimate - cur_snp.ctg_pos) > 2:
                            if abs(contig_estimate - cur_snp[3]) > 2:
                                if enable_SNPs_output:
                                    print >> ca_output.stdout_f, '\t\t\t\t\tERROR: SNP position in contig was off by %d bp! (%d vs %d)' \
                                             % (abs(contig_estimate - cur_snp[3]), contig_estimate, cur_snp[3])
#                                             % (abs(contig_estimate - cur_snp.ctg_pos), contig_estimate, cur_snp.ctg_pos)
                                continue

                            print >> ca_output.used_snps_f, '%s\t%s\t%d\t%s\t%s\t%d' % (ref, current[8], cur_snp[2],
                                                                                 cur_snp[4], cur_snp[5], cur_snp[3])
#                            print >> ca_output.used_snps_f, '%s\t%s\t%d\t%s\t%s\t%d' % (ref, current[8], cur_snp.ref_pos,
#                                                                                 cur_snp.ref_nucl, cur_snp.ctg_nucl, cur_snp.ctg_pos)

                            #If SNP is an insertion, record
                            if snp == 'I':
                                total_indels_info.insertions += 1
                                if pos_strand: contig_estimate += 1
                                else: contig_estimate -= 1
                            #If SNP is a deletion, record
                            if snp == 'D':
                                total_indels_info.deletions += 1
                                if pos_strand: contig_estimate -= 1
                                else: contig_estimate += 1
                            #If SNP is a mismatch, record
                            if snp == 'S':
                                total_indels_info.mismatches += 1

#                            if cur_snp.type == 'D' or cur_snp.type == 'I':
#                                if prev_snp and ((cur_snp.type == 'D' and (prev_snp.ref_pos == cur_snp.ref_pos - 1) and (prev_snp.ctg_pos == cur_snp.ctg_pos)) or
#                                     (cur_snp.type == 'I' and ((pos_strand and (prev_snp.ctg_pos == cur_snp.ctg_pos - 1)) or
#                                         (not pos_strand and (prev_snp.ctg_pos == cur_snp.ctg_pos + 1))) and (prev_snp.ref_pos == cur_snp.ref_pos))):
                            if cur_snp[6] == 'D' or cur_snp[6] == 'I':
                                if prev_snp and ((cur_snp[6] == 'D' and (prev_snp[2] == cur_snp[2] - 1) and (prev_snp[3] == cur_snp[3])) or
                                     (cur_snp[6] == 'I' and ((pos_strand and (prev_snp[3] == cur_snp[3] - 1)) or
                                         (not pos_strand and (prev_snp[3] == cur_snp[3] + 1))) and (prev_snp[2] == cur_snp[2]))):
                                    cur_indel += 1
                                else:
                                    if cur_indel:
                                        total_indels_info.indels_list.append(cur_indel)
                                    cur_indel = 1
                                prev_snp = cur_snp

                    if pos_strand: contig_estimate += 1
                    else: contig_estimate -= 1

                #Record Ns in current alignment
                if current[2] < current[3]:
                    #print "\t\t(forward)Recording Ns from $current[3]+$snip_left to $current[4]-$snip_right...\n";
                    for i in (current[2] + snip_left, current[3] - snip_right + 1):
                        if (len(current)==10) and (i in current[9]):
                            region_ambig += 1
                else:
                    #print "\t\t(reverse)Recording Ns from $current[4]+$snip_right to $current[3]-$snip_left...\n";
                    for i in (current[3] + snip_left, current[2] - snip_right + 1):
                        if (len(current)==10) and (i in current[9]):
                            region_ambig += 1
                snip_left = 0
                snip_right = 0

                if cur_indel:
                    total_indels_info.indels_list.append(cur_indel)
                prev_snp = None
                cur_indel = 0

                print >> ca_output.stdout_f

    SNPs = total_indels_info.mismatches
    indels_list = total_indels_info.indels_list
    total_aligned_bases = region_covered
    result = {'SNPs': SNPs, 'indels_list': indels_list, 'total_aligned_bases': total_aligned_bases, 'total_redundant':
              total_redundant, 'redundant': redundant, 'gaps': gaps, 'neg_gaps': neg_gaps, 'uncovered_regions': uncovered_regions,
              'uncovered_region_bases': uncovered_region_bases, 'region_covered': region_covered}

    return result


