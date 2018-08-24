import React from "react";
import autoBind from "react-autobind";
import * as linter from "replicated-lint";
import Linter from "../shared/Linter";
// import MonacoEditor from "react-monaco-editor";
import * as monaco from "monaco-editor";
import ErrorBoundary from "../../ErrorBoundary";
import get from "lodash/get";
import find from "lodash/find";

import "../../scss/components/kustomize/HelmValuesEditor.scss";

export default class HelmValuesEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      readOnly: false,
      showConsole: false,
      specErrors: [],
      specErrorMarkers: [],
      specValue: "",
      initialSpecValue: "",
      helmLintErrors: [],
      saving: false,
      saveFinal: false,
      unsavedChanges: false,
    }
    autoBind(this);
  }

  componentDidMount() {
    const newEditor = monaco.editor.create(document.getElementById("monaco-mount"), {
      value: "",
      language: "yaml",
      minimap: {
        enabled: false
      },
      scrollBeyondLastLine: false,
    });
    newEditor.onKeyUp(() => {
      this.onSpecChange(newEditor.getValue());
    });
    // newEditor.getModel().onDidChangeDecorations(() => {
    //   newEditor.render();
    // })
    this.setState({
      editor: newEditor
    })
    if(this.props.getStep.values) {
      this.setState({
        initialSpecValue: this.props.getStep.values,
        specValue: this.props.getStep.values
      })
    }
  }

  editorDidMount(editor) {
    editor.focus();
  }

  componentDidUpdate(lastProps, lastState) {
    if (this.state.specValue !== lastState.specValue && this.state.specValue !== "") {
      this.state.editor.getModel().setValue(this.state.specValue);
      // this.getLinterErrors();
    }
  }

  setMarkers() {
    this.state.editor.deltaDecorations([], this.state.specErrorMarkers);
  }

  getLinterErrors(specContents) {
    if (specContents === "") return;

    const errors = new linter.Linter(specContents).lint();
    let markers = [];
    for (let error of errors) {
      if (error.positions) {
        for (let position of error.positions) {
          let line = get(position, "start.line");
          let column = get(position, "start.column");
          const range = new monaco.Range(line, column, line + 1, column);
          if (line) {
            markers.push({
              range,
              options: {
                isWholeLine: true,
                className: "error-highlight",
                hoverMessage: {
                  value: error.message,
                  isTrusted: true
                }
              }
            })
          }
        }
      }
    }
    this.setState({
      specErrors: errors,
      specErrorMarkers: markers,
    });
    this.setMarkers();
  }

  onSpecChange(newValue) {
    const { initialSpecValue } = this.state;
    this.getLinterErrors(newValue);
    this.setState({
      specValue: newValue,
      unsavedChanges: !(initialSpecValue === newValue)
    });
  }

  handleContinue() {
    const { actions } = this.props;
    let submitAction;
    submitAction = find(actions, ["buttonType", "popover"]);
    this.props.handleAction(submitAction, true);
  }

  handleSkip() {
    const { initialSpecValue } = this.state;
    const payload = {
      values: initialSpecValue
    }
    this.setState({ helmLintErrors: [] });
    this.props.saveValues(payload)
      .then(({ errors }) => {
        if (errors) {
          return this.setState({
            saving: false, helmLintErrors: errors
          });
        }
        this.handleContinue();
      })
      .catch((err) => {
        // TODO: better handling
        console.log(err);
      })
  }

  handleSaveValues(finalize) {
    const { specValue } = this.state;
    const payload = {
      values: specValue
    }
    if (payload.values !== "") {
      this.setState({ saving: true, savedYaml: false, saveFinal: finalize, helmLintErrors: [] });
      this.props.saveValues(payload)
        .then(({ errors }) => {
          if (errors) {
            return this.setState({
              saving: false,
              helmLintErrors: errors
            });
          }
          this.setState({ saving: false, savedYaml: true });
          if (finalize) {
            this.handleContinue();
          } else {
            setTimeout(() => {
              if (this.helmEditor) {
                this.setState({ savedYaml: false });
              }
            }, 3000);
          }
        })
        .catch((err) => {
          // TODO: better handling
          console.log(err);
        })
    }
  }

  render() {
    const {
      specValue,
      initialSpecValue,
      saving,
      saveFinal,
      savedYaml,
      helmLintErrors,
    } = this.state;
    const {
      values,
      readme,
      name
    } = this.props.shipAppMetadata;

    return (
      <ErrorBoundary>
        <div className="flex-column flex1 HelmValues--wrapper u-paddingTop--30">
          <div className="flex-column flex-1-auto u-overflow--auto container">
            <p className="u-color--dutyGray u-fontStize--large u-fontWeight--medium u-marginBottom--small">
            /{name}/
              <span className="u-color--tuna u-fontWeight--bold">values.yaml</span>
            </p>
            <p className="u-color--dustyGray u-fontSize--normal u-marginTop--normal u-marginBottom--20">Here you can edit the values.yaml to specify values for your application. You will be able to apply overlays for your YAML in the next step.</p>
            <div className="CodeEditor--wrapper helm-values flex1 flex u-height--full u-width--full">
              <div className="flex1 flex-column u-width--half u-overflow--hidden">
                <div id="monaco-mount" style={{height: "100%", width: "100%"}}></div>
              </div>
              <div className={`flex-auto flex-column console-wrapper u-width--third ${!this.state.showConsole ? "visible" : ""}`}>
                <Linter errors={this.state.specErrors} spec={values} previewEnabled={true} readme={readme} />
              </div>
            </div>
          </div>
          <div className="actions-wrapper container u-width--full flex flex-auto justifyContent--flexEnd">
            <div className="flex-column flex-verticalCenter">
              {helmLintErrors.length ?
                <p className="u-color--chestnut u-fontSize--small u-fontWeight--medium u-marginRight--normal u-lineHeight--normal">{helmLintErrors.join("\n")}</p>
                : null}
              {savedYaml ?
                <p className="u-color--vidaLoca u-fontSize--small u-fontWeight--medium u-marginRight--normal u-lineHeight--normal">Values saved</p>
                : null}
            </div>
            <div className="flex flex-auto alignItems--center">
              {initialSpecValue === specValue ?
                <button className="btn primary" onClick={() => { this.handleSkip() }}>Continue</button>
                :
                <div className="flex">
                  <button className="btn primary u-marginRight--normal" onClick={() => this.handleSaveValues(false)} disabled={saving || saveFinal}>{saving ? "Saving" : "Save values"}</button>
                  <button className="btn secondary" onClick={() => this.handleSaveValues(true)} disabled={saving || saveFinal}>{saveFinal ? "Saving values" : "Save & continue"}</button>
                </div>
              }
            </div>
          </div>

        </div>
      </ErrorBoundary>
    );
  }
}
