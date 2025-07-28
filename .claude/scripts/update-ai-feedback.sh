#!/bin/bash

# AI Feedback Updater
# Updates the AI feedback tracker based on user interactions

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FEEDBACK_FILE=".claude/memory/ai-feedback-tracker.json"
BACKUP_DIR=".claude/memory/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to backup current feedback file
backup_feedback() {
    if [ -f "$FEEDBACK_FILE" ]; then
        timestamp=$(date +"%Y%m%d_%H%M%S")
        cp "$FEEDBACK_FILE" "$BACKUP_DIR/ai-feedback-tracker_${timestamp}.json"
        echo -e "${GREEN}✓ Backed up current feedback to ${BACKUP_DIR}${NC}"
    fi
}

# Function to add accepted pattern
add_accepted_pattern() {
    local category="$1"
    local pattern="$2"
    local context="$3"
    
    echo -e "${BLUE}Adding accepted pattern:${NC}"
    echo "  Category: $category"
    echo "  Pattern: $pattern"
    echo "  Context: $context"
    
    # Use jq to update the JSON file
    jq --arg cat "$category" \
       --arg pat "$pattern" \
       --arg ctx "$context" \
       '.acceptedPatterns[$cat] += [{
           "pattern": $pat,
           "context": $ctx,
           "acceptanceRate": 1.0,
           "examples": []
       }]' "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
    mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    
    echo -e "${GREEN}✓ Pattern added successfully${NC}"
}

# Function to add rejected pattern
add_rejected_pattern() {
    local pattern="$1"
    local reason="$2"
    local alternative="$3"
    
    echo -e "${BLUE}Adding rejected pattern:${NC}"
    echo "  Pattern: $pattern"
    echo "  Reason: $reason"
    echo "  Alternative: $alternative"
    
    jq --arg pat "$pattern" \
       --arg rsn "$reason" \
       --arg alt "$alternative" \
       '.rejectedPatterns.avoid += [{
           "pattern": $pat,
           "reason": $rsn,
           "rejectionRate": 1.0,
           "alternative": $alt
       }]' "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
    mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    
    echo -e "${GREEN}✓ Rejection pattern added${NC}"
}

# Function to update metrics
update_metrics() {
    local category="$1"
    local accepted="$2"
    
    echo -e "${BLUE}Updating metrics for category: $category${NC}"
    
    # Get current stats
    current=$(jq -r ".learningMetrics.suggestionAcceptance.byCategory.$category // 0.5" "$FEEDBACK_FILE")
    total=$(jq -r '.learningMetrics.totalSuggestions // 0' "$FEEDBACK_FILE")
    
    # Calculate new rate (simple moving average)
    if [ "$accepted" == "true" ]; then
        new_value=1
    else
        new_value=0
    fi
    
    # Update with weighted average
    new_rate=$(echo "scale=2; ($current * $total + $new_value) / ($total + 1)" | bc)
    new_total=$((total + 1))
    
    # Update JSON
    jq --arg cat "$category" \
       --arg rate "$new_rate" \
       --arg total "$new_total" \
       '.learningMetrics.suggestionAcceptance.byCategory[$cat] = ($rate | tonumber) |
        .learningMetrics.totalSuggestions = ($total | tonumber)' \
       "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
    mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    
    echo -e "${GREEN}✓ Metrics updated: $category acceptance rate = $new_rate${NC}"
}

# Function to add common feedback
add_feedback() {
    local feedback="$1"
    local adjustment="$2"
    
    echo -e "${BLUE}Recording feedback:${NC}"
    echo "  Feedback: $feedback"
    echo "  Adjustment: $adjustment"
    
    # Check if feedback already exists
    exists=$(jq --arg fb "$feedback" '.learningMetrics.commonFeedback[] | select(.feedback == $fb)' "$FEEDBACK_FILE")
    
    if [ -n "$exists" ]; then
        # Update frequency
        jq --arg fb "$feedback" \
           '(.learningMetrics.commonFeedback[] | select(.feedback == $fb) | .frequency) += 0.01' \
           "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
        mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    else
        # Add new feedback
        jq --arg fb "$feedback" \
           --arg adj "$adjustment" \
           '.learningMetrics.commonFeedback += [{
               "feedback": $fb,
               "frequency": 0.01,
               "adjustment": $adj
           }]' "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
        mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    fi
    
    echo -e "${GREEN}✓ Feedback recorded${NC}"
}

# Function to add improvement
add_improvement() {
    local improvement="$1"
    local impact="$2"
    
    echo -e "${BLUE}Recording improvement:${NC}"
    echo "  Improvement: $improvement"
    echo "  Impact: $impact"
    
    date=$(date +"%Y-%m-%d")
    
    jq --arg date "$date" \
       --arg imp "$improvement" \
       --arg impact "$impact" \
       '.improvementTracking.recentImprovements += [{
           "date": $date,
           "improvement": $imp,
           "impact": $impact
       }]' "$FEEDBACK_FILE" > "${FEEDBACK_FILE}.tmp" && \
    mv "${FEEDBACK_FILE}.tmp" "$FEEDBACK_FILE"
    
    echo -e "${GREEN}✓ Improvement recorded${NC}"
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}AI Feedback Tracker${NC}"
    echo "===================="
    echo "1. Record accepted pattern"
    echo "2. Record rejected pattern"
    echo "3. Update suggestion metrics"
    echo "4. Add common feedback"
    echo "5. Record improvement"
    echo "6. View current stats"
    echo "7. Exit"
    echo
}

# View stats function
view_stats() {
    echo -e "\n${BLUE}Current AI Performance Stats${NC}"
    echo "============================="
    
    overall=$(jq -r '.learningMetrics.suggestionAcceptance.overall' "$FEEDBACK_FILE")
    echo -e "Overall Acceptance Rate: ${GREEN}${overall}${NC}"
    
    echo -e "\nBy Category:"
    jq -r '.learningMetrics.suggestionAcceptance.byCategory | to_entries[] | "  \(.key): \(.value)"' "$FEEDBACK_FILE"
    
    echo -e "\nRecent Improvements:"
    jq -r '.improvementTracking.recentImprovements[-3:][] | "  • \(.improvement) (\(.date))"' "$FEEDBACK_FILE"
    
    echo -e "\nTop Feedback:"
    jq -r '.learningMetrics.commonFeedback | sort_by(-.frequency)[:3][] | "  • \(.feedback) (freq: \(.frequency))"' "$FEEDBACK_FILE"
}

# Interactive mode
if [ $# -eq 0 ]; then
    while true; do
        show_menu
        read -p "Select option: " choice
        
        case $choice in
            1)
                read -p "Category (codeStructure/testingApproaches/errorHandling): " category
                read -p "Pattern description: " pattern
                read -p "Context: " context
                backup_feedback
                add_accepted_pattern "$category" "$pattern" "$context"
                ;;
            2)
                read -p "Pattern to avoid: " pattern
                read -p "Reason: " reason
                read -p "Alternative approach: " alternative
                backup_feedback
                add_rejected_pattern "$pattern" "$reason" "$alternative"
                ;;
            3)
                read -p "Category (performance/security/refactoring/newFeatures/bugFixes): " category
                read -p "Was suggestion accepted? (true/false): " accepted
                backup_feedback
                update_metrics "$category" "$accepted"
                ;;
            4)
                read -p "Feedback received: " feedback
                read -p "Adjustment to make: " adjustment
                backup_feedback
                add_feedback "$feedback" "$adjustment"
                ;;
            5)
                read -p "Improvement description: " improvement
                read -p "Impact: " impact
                backup_feedback
                add_improvement "$improvement" "$impact"
                ;;
            6)
                view_stats
                ;;
            7)
                echo -e "${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${YELLOW}Invalid option${NC}"
                ;;
        esac
    done
else
    # Command line mode
    case "$1" in
        accept)
            backup_feedback
            add_accepted_pattern "$2" "$3" "$4"
            ;;
        reject)
            backup_feedback
            add_rejected_pattern "$2" "$3" "$4"
            ;;
        metric)
            backup_feedback
            update_metrics "$2" "$3"
            ;;
        feedback)
            backup_feedback
            add_feedback "$2" "$3"
            ;;
        improve)
            backup_feedback
            add_improvement "$2" "$3"
            ;;
        stats)
            view_stats
            ;;
        *)
            echo "Usage: $0 [command] [args...]"
            echo "Commands:"
            echo "  accept <category> <pattern> <context>"
            echo "  reject <pattern> <reason> <alternative>"
            echo "  metric <category> <true|false>"
            echo "  feedback <feedback> <adjustment>"
            echo "  improve <improvement> <impact>"
            echo "  stats"
            echo ""
            echo "Or run without arguments for interactive mode"
            ;;
    esac
fi