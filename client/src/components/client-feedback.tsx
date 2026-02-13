import { useState } from "react";
import { CollapsibleSection } from "./collapsible-section";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, ListTodo, Plus, Trash2, ArrowRight } from "lucide-react";

export interface FollowUpTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface ClientFeedback {
  notes: string;
  followUpTasks: FollowUpTask[];
}

interface ClientFeedbackProps {
  feedback: ClientFeedback;
  onFeedbackChange: (feedback: ClientFeedback) => void;
  previousFollowUps?: FollowUpTask[];
}

export function ClientFeedbackSection({ feedback, onFeedbackChange, previousFollowUps }: ClientFeedbackProps) {
  const [newTask, setNewTask] = useState("");

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    const task: FollowUpTask = {
      id: Date.now().toString(),
      text,
      completed: false,
    };
    onFeedbackChange({
      ...feedback,
      followUpTasks: [...feedback.followUpTasks, task],
    });
    setNewTask("");
  };

  const removeTask = (id: string) => {
    onFeedbackChange({
      ...feedback,
      followUpTasks: feedback.followUpTasks.filter(t => t.id !== id),
    });
  };

  const toggleTask = (id: string) => {
    onFeedbackChange({
      ...feedback,
      followUpTasks: feedback.followUpTasks.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    });
  };

  const carryOverTask = (task: FollowUpTask) => {
    const exists = feedback.followUpTasks.some(t => t.text === task.text);
    if (exists) return;
    onFeedbackChange({
      ...feedback,
      followUpTasks: [...feedback.followUpTasks, { ...task, id: Date.now().toString(), completed: false }],
    });
  };

  const hasNotes = feedback.notes.trim().length > 0;
  const hasTasks = feedback.followUpTasks.length > 0;
  const incompletePrevious = previousFollowUps?.filter(t => !t.completed) || [];

  return (
    <CollapsibleSection
      title="Client Feedback & Follow-Up"
      icon={<MessageSquare className="h-5 w-5" />}
      testId="section-client-feedback"
      headerRight={
        hasTasks ? (
          <Badge variant="secondary" className="text-xs">
            {feedback.followUpTasks.filter(t => !t.completed).length} open
          </Badge>
        ) : null
      }
    >
      <div className="space-y-4">
        {incompletePrevious.length > 0 && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 px-3 py-2 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <ArrowRight className="h-4 w-4 flex-shrink-0" />
              Open items from previous review
            </div>
            <div className="space-y-1.5 ml-6">
              {incompletePrevious.map((task, i) => {
                const alreadyAdded = feedback.followUpTasks.some(t => t.text === task.text);
                return (
                  <div key={i} className="flex items-center gap-2 text-sm" data-testid={`previous-task-${i}`}>
                    <span className="flex-1 text-blue-700 dark:text-blue-300">{task.text}</span>
                    {alreadyAdded ? (
                      <Badge variant="outline" className="text-xs flex-shrink-0">Added</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => carryOverTask(task)}
                        data-testid={`button-carry-over-${i}`}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Carry Over
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Client Feedback</span>
            {hasNotes && <Badge variant="secondary" className="text-xs">Entered</Badge>}
          </div>
          <Textarea
            placeholder="Notes from the client during or after the meeting... e.g., contact changes, concerns raised, decisions made..."
            value={feedback.notes}
            onChange={(e) => onFeedbackChange({ ...feedback, notes: e.target.value })}
            className="min-h-[80px] resize-y text-sm"
            data-testid="textarea-client-feedback"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Follow-Up Tasks</span>
          </div>

          {feedback.followUpTasks.length > 0 && (
            <div className="space-y-1.5">
              {feedback.followUpTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2"
                  data-testid={`follow-up-task-${task.id}`}
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => toggleTask(task.id)}
                    data-testid={`checkbox-task-${task.id}`}
                  />
                  <span className={`flex-1 text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                    {task.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTask(task.id)}
                    data-testid={`button-remove-task-${task.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              placeholder="Add a follow-up task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTask();
                }
              }}
              className="flex-1"
              data-testid="input-new-task"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addTask}
              disabled={!newTask.trim()}
              data-testid="button-add-task"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
